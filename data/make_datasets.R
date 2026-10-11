# ---------------------------------------------------------------
# Учебные данные для курса «R для медицинской статистики»
# ВСЕ ДАННЫЕ ВЫМЫШЛЕННЫЕ (смоделированы случайным образом).
# Это не результаты реального исследования и не реальные пациенты.
#
# Запуск: source("make_datasets.R") — создаст три CSV-файла
#   trial.csv     — РКИ «ДЕПРЕССИЯ-12»: 3 группы × 40 пациентов
#   screening.csv — скрининг PHQ-9 у 250 амбулаторных пациентов
#   raters.csv    — два эксперта оценивают одних и тех же 40 пациентов
# ---------------------------------------------------------------

set.seed(2024)
clamp <- function(x, lo, hi) pmin(pmax(x, lo), hi)

# ---------- 1. РКИ: placebo / dose10 / dose20 ----------
n_arm <- 40
arm <- factor(rep(c("placebo", "dose10", "dose20"), each = n_arm),
              levels = c("placebo", "dose10", "dose20"))
n <- length(arm)

age    <- clamp(round(rnorm(n, 41, 12)), 18, 65)
sex    <- factor(sample(c("F", "M"), n, replace = TRUE, prob = c(0.62, 0.38)))
hamd_0 <- clamp(round(rnorm(n, 23, 3.5)), 18, 34)

true_change <- c(placebo = -8, dose10 = -10, dose20 = -12.5)[as.character(arm)]
indiv       <- true_change + rnorm(n, 0, 6)
visit <- function(frac) clamp(round(hamd_0 + indiv * frac + rnorm(n, 0, 2)), 0, 52)
hamd_2 <- visit(0.35)
hamd_4 <- visit(0.70)
hamd_8 <- visit(1.00)

response  <- as.integer((hamd_0 - hamd_8) / hamd_0 >= 0.5)  # снижение >= 50 %
remission <- as.integer(hamd_8 <= 7)                        # HAM-D-17 <= 7

p_nausea <- c(placebo = 0.06, dose10 = 0.12, dose20 = 0.25)[as.character(arm)]
nausea   <- rbinom(n, 1, p_nausea)

# Наблюдение после 8-й недели: время до рецидива (недели), максимум 52
rate  <- c(placebo = 0.028, dose10 = 0.018, dose20 = 0.010)[as.character(arm)]
t_rel <- rexp(n, rate)
t_cen <- runif(n, 30, 70)
relapse_week <- round(pmin(t_rel, t_cen, 52), 1)
relapse      <- as.integer(t_rel <= pmin(t_cen, 52))

phq9_0 <- clamp(round(0.75 * hamd_0 + rnorm(n, 0, 3)), 0, 27)

# Редкое нежелательное явление — кожная сыпь
p_rash <- c(placebo = 0.02, dose10 = 0.05, dose20 = 0.15)[as.character(arm)]
rash   <- rbinom(n, 1, p_rash)

trial <- data.frame(id = sprintf("P%03d", 1:n), arm, age, sex,
                    hamd_0, hamd_2, hamd_4, hamd_8, phq9_0,
                    response, remission, nausea, rash, relapse_week, relapse)

# ---------- 2. Скрининг PHQ-9 ----------
m   <- 250
mdd <- rbinom(m, 1, 0.30)                        # диагноз по структурированному интервью
latent <- rnorm(m, ifelse(mdd == 1, 1.6, 0), 1)  # скрытая тяжесть
items <- sapply(1:9, function(j) clamp(round(0.75 + 0.55 * latent + rnorm(m, 0, 0.6)), 0, 3))
colnames(items) <- paste0("phq_", 1:9)
screening <- data.frame(id = sprintf("S%03d", 1:m), items,
                        phq9 = rowSums(items), mdd)

# ---------- 3. Два эксперта ----------
k <- 40
true_score <- clamp(round(rnorm(k, 18, 6)), 2, 40)
raters <- data.frame(
  id      = sprintf("R%02d", 1:k),
  hamd_r1 = clamp(true_score + round(rnorm(k, 0, 1.8)), 0, 52),
  hamd_r2 = clamp(true_score + round(rnorm(k, 1, 1.8)), 0, 52)
)
raters$dx_r1 <- ifelse(raters$hamd_r1 >= 17, "yes", "no")
raters$dx_r2 <- ifelse(raters$hamd_r2 >= 17, "yes", "no")

write.csv(trial,     "trial.csv",     row.names = FALSE)
write.csv(screening, "screening.csv", row.names = FALSE)
write.csv(raters,    "raters.csv",    row.names = FALSE)
