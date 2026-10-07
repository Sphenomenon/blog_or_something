import App from "../src/App.jsx";
import { SiteFonts } from "../src/components/SiteFonts.jsx";
import { SITE_TITLE, SITE_DESCRIPTION } from "../src/lib/route-metadata.js";
import "../src/styles.css";

export const metadata = {
  title: { default: SITE_TITLE, template: "%s · 失眠档案馆" },
  description: SITE_DESCRIPTION,
  icons: { icon: "/logo.ico" }
};

export default function RootLayout({ children }) {
  return <html lang="zh-Hans"><head>
    <link rel="preconnect" href="https://fonts.loli.net" />
    <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
  </head><body><SiteFonts /><App>{children}</App></body></html>;
}
