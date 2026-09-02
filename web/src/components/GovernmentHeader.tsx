import logo from '../assets/USCIS_Signature_Preferred_FC.png';

type GovernmentHeaderProps = {
  compact?: boolean;
};

export default function GovernmentHeader({ compact = false }: GovernmentHeaderProps) {
  return (
    <header className={`government-header${compact ? ' government-header--compact' : ''}`}>
      <div className="government-header__inner">
        <img
          src={logo}
          alt="U.S. Citizenship and Immigration Services"
          className="government-header__logo"
        />
        <div className="government-header__rule" aria-hidden="true" />
        <p className="government-header__service">Biometric identity services</p>
      </div>
    </header>
  );
}