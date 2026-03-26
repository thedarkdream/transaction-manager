import './App.css';
import { Routes, Route, BrowserRouter, Link, Navigate } from 'react-router-dom';
import TransactionsPage from './pages/TransactionsPage';
import CategoriesPage from './pages/CategoriesPage';
import ImportPage from './pages/ImportPage';
import PartnersPage from './pages/PartnersPage';


function App() {

  return (
    <div className="app-root">
      <BrowserRouter>
        <nav className="app-nav">
          <span className="brand">Transactions</span>
          <Link to="/transactions">Transactions</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/partners">Partners</Link>
          <Link to="/import">Import</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Navigate to="/transactions" replace />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );

}

export default App;
