import { t } from "@/content/strings";
import { CreatePage } from "@/features/create/CreatePage";
import { HowItWorksPage } from "@/features/docs/HowItWorksPage";
import { LegalPage } from "@/features/docs/LegalPage";
import { RevealPage } from "@/features/reveal/RevealPage";
import { Layout } from "@/ui/components/Layout";
import { ConfigProvider } from "./config";
import { Link, useRoute } from "./router";

export function App() {
  return (
    <ConfigProvider>
      <Layout>
        <Page />
      </Layout>
    </ConfigProvider>
  );
}

function Page() {
  const route = useRoute();
  switch (route.name) {
    case "create":
      return <CreatePage />;
    case "reveal":
      // Keyed so a different secret starts from a clean state.
      return <RevealPage key={route.id} id={route.id} />;
    case "how":
      return <HowItWorksPage />;
    case "legal":
      return <LegalPage />;
    case "notFound":
      return (
        <div className="dead">
          <pre className="dead-code" aria-hidden="true">
            {t.notFound.title}
          </pre>
          <p className="muted">{t.notFound.help}</p>
          <Link to="/" className="btn btn-secondary">
            {t.nav.new}
          </Link>
        </div>
      );
  }
}
