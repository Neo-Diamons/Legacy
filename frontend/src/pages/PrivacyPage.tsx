import { Link } from 'react-router-dom';

/** Keep in sync with `PRIVACY_POLICY_VERSION` in backend/src/utils/privacy.ts. */
export const PRIVACY_POLICY_VERSION = '2026-09-30';

export function PrivacyPage() {
  return (
    <div className="page privacy-page">
      <header className="page-header">
        <h1 className="page-title">Politique de confidentialité</h1>
        <p className="text-muted mb-0">Version du {PRIVACY_POLICY_VERSION}</p>
      </header>

      <div className="widget-card">
        <h2 className="h5">Données collectées</h2>
        <p>
          Lors de l’inscription, nous enregistrons votre nom, votre adresse e-mail et une empreinte irréversible de
          votre mot de passe (jamais le mot de passe lui-même). Vos projets et vos tâches sont rattachés à votre compte
          et ne sont visibles que par vous.
        </p>

        <h2 className="h5">Finalité</h2>
        <p>Ces données servent uniquement à vous authentifier et à fournir l’application de gestion de tâches.</p>

        <h2 className="h5">Consentement</h2>
        <p>
          En créant un compte, vous acceptez cette politique. La date de votre consentement et la version de la
          politique acceptée sont conservées avec votre compte.
        </p>

        <h2 className="h5">Durée de conservation</h2>
        <p>
          Vos données sont conservées tant que votre compte existe. Aucune autre durée de conservation n’est définie
          pour le moment ; la suppression de votre compte efface vos projets et vos tâches.
        </p>

        <h2 className="h5">Vos droits</h2>
        <p>
          Depuis votre profil, vous pouvez modifier votre nom et supprimer votre compte. Vous pouvez exporter vos
          données au format JSON via l’API (<code>GET /users/:id/export</code>). Pour toute autre demande, contactez le
          responsable du traitement de l’instance que vous utilisez.
        </p>

        <Link to="/">Retour à l’application</Link>
      </div>
    </div>
  );
}
