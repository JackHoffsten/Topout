import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main>
      <h1>Topout</h1>
      <p>Start building your product here.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
