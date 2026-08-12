import LandingNavbar from './components/landing/LandingNavbar';
import Hero from './components/landing/Hero';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <LandingNavbar />
      <Hero />
    </div>
  );
}
