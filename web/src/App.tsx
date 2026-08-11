import { BrowserRouter, Routes, Route} from 'react-router-dom';

import Login from './pages/Login';
import Home from './pages/Home';
import Verification from './pages/Verification';

function App() {

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/verification" element={<Verification />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App
