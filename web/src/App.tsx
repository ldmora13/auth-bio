import { BrowserRouter, Routes, Route} from 'react-router-dom';

import Login from './pages/Login';
import Verification from './pages/Verification';

function App() {

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verification" element={<Verification />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App
