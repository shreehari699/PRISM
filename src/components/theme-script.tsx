/**
 * Blocking inline script that sets the `dark` class before first paint.
 * PRISM is dark-first: an unset preference defaults to dark rather than
 * following the OS, matching the "research lab / consulting firm"
 * direction rather than a generic light SaaS default. Runs before
 * hydration so there is no flash of the wrong theme.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("prism-theme");
    var theme = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
