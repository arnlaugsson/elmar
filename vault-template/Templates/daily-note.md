# <% tp.date.now("YYYY-MM-DD") %>

## Journal
<!-- Free writing -->

## Gratitude
-

## Tracking
<%*
const metricsFile = app.vault.getAbstractFileByPath("_System/metrics.json");
if (metricsFile) {
  const content = await app.vault.read(metricsFile);
  const registry = JSON.parse(content);
  for (const metric of registry.metrics) {
    tR += metric.key + "::\n";
  }
}
%>

## Tasks
- [ ]

## Notes
<!-- Anything captured during the day -->
