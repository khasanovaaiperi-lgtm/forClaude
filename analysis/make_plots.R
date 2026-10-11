# Рисунки для сайта. Запускать из папки data/.
suppressPackageStartupMessages({library(ggplot2); library(survival); library(pROC); library(tidyr)})
trial <- read.csv("trial.csv", stringsAsFactors = TRUE)
trial$arm <- factor(trial$arm, levels = c("placebo", "dose10", "dose20"))
trial$change <- trial$hamd_8 - trial$hamd_0
screening <- read.csv("screening.csv")
out <- "../assets/img/"
pal <- c(placebo = "#8a96a0", dose10 = "#6aa0dc", dose20 = "#1f5fad")
th <- theme_minimal(base_size = 12) + theme(panel.grid.minor = element_blank())
save <- function(p, f, w = 6, h = 3.6) ggsave(paste0(out, f), p, width = w, height = h, dpi = 110)

save(ggplot(trial, aes(hamd_0)) + geom_histogram(binwidth = 1, fill = "#1f5fad", colour = "white") +
  labs(x = "HAM-D на старте, баллы", y = "Число пациентов") + th, "hist_hamd0.png")

save(ggplot(trial, aes(arm, change, colour = arm)) + geom_boxplot(outlier.shape = NA, width = 0.5) +
  geom_jitter(width = 0.15, alpha = 0.6) + scale_colour_manual(values = pal, guide = "none") +
  labs(x = NULL, y = "Изменение HAM-D к 8-й неделе") + th, "box_change.png")

save(ggplot(trial, aes(hamd_0, phq9_0)) + geom_jitter(width = 0.2, height = 0.2, alpha = 0.6, colour = "#1f5fad") +
  geom_smooth(method = "lm", formula = y ~ x, colour = "#16232b") +
  labs(x = "HAM-D (оценка врача)", y = "PHQ-9 (самоотчёт)") + th, "scatter_phq_hamd.png")

save(ggplot(trial, aes(sample = change)) + stat_qq(colour = "#1f5fad") + stat_qq_line() +
  labs(x = "Теоретические квантили", y = "Наблюдаемые значения") + th, "qq_change.png", 5, 3.6)

long <- pivot_longer(trial, c(hamd_0, hamd_2, hamd_4, hamd_8), names_to = "week", names_prefix = "hamd_", values_to = "hamd")
long$week <- as.numeric(long$week)
save(ggplot(long, aes(week, hamd, colour = arm)) + geom_line(aes(group = id), alpha = 0.15) +
  stat_summary(fun = mean, geom = "line", linewidth = 1.3) + stat_summary(fun = mean, geom = "point", size = 2) +
  scale_colour_manual(values = pal, name = NULL) + scale_x_continuous(breaks = c(0, 2, 4, 8)) +
  labs(x = "Неделя", y = "HAM-D") + th, "trajectories.png")

png(paste0(out, "km.png"), width = 660, height = 400, res = 100)
par(mar = c(4, 4, 1, 1))
km <- survfit(Surv(relapse_week, relapse) ~ arm, data = trial)
plot(km, col = pal, lwd = 2, mark.time = TRUE, xlab = "Недели после 8-й недели лечения", ylab = "Доля без рецидива", las = 1)
legend("topright", legend = names(pal), col = pal, lwd = 2, bty = "n")
dev.off()

png(paste0(out, "roc.png"), width = 480, height = 440, res = 100)
par(mar = c(4, 4, 1, 1))
r <- roc(screening$mdd, screening$phq9, quiet = TRUE)
plot(r, col = "#1f5fad", lwd = 2, print.auc = TRUE, print.thres = 9.5, legacy.axes = TRUE,
     xlab = "1 - специфичность", ylab = "Чувствительность")
dev.off()
