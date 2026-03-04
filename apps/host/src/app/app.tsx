import * as React from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import NxWelcome from "./nx-welcome";
import { Link, Route, Routes } from 'react-router-dom';

const Shop = React.lazy(() => loadRemote('shop/Module') as any);
const Cart = React.lazy(() => loadRemote('cart/Module') as any);
const About = React.lazy(() => loadRemote('about/Module') as any);

export function App() {
  return (
    <React.Suspense fallback={null}>
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/shop">Shop</Link></li>
        <li><Link to="/cart">Cart</Link></li>
        <li><Link to="/about">About</Link></li>
      </ul>
      <Routes>
        <Route path="/" element={<NxWelcome title="host"/>} />
        <Route path="/shop" element={<Shop/>} />
        <Route path="/cart" element={<Cart/>} />
        <Route path="/about" element={<About/>} />
      </Routes>
    </React.Suspense>
  );
}

export default App;
