import React, { useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ProductList, Cart, SearchBar } from '../components/pos';

const client = generateClient<Schema>();

type CartItem = {
  id?: string;
  descripcion: string;
  precio_unitario: number;
  cantidad: number;
  tipo_item: 'PRODUCTO' | 'SERVICIO';
  productoId?: string;
};

export const POSPage: React.FC = () => {
  const { user, signOut } = useAuthenticator();
  const [products, setProducts] = useState<Array<Schema["Productos"]["type"]>>([]);
  const [cajaAbierta, setCajaAbierta] = useState<Schema["Caja"]["type"] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const modelos: any = (client as any).models;
    if (!modelos?.Productos) {
      setErrorMsg('Backend no sincronizado con el nuevo esquema (model Productos no disponible). Despliega el backend y actualiza amplify_outputs.json.');
      return;
    }
    
    const sub = modelos.Productos.observeQuery({
      selectionSet: ["id","nombre_pruducto","precio","stock","sedeId","createdAt","updatedAt"]
    }).subscribe({
      next: (data: any) => setProducts([...data.items] as any),
      error: (e: any) => setErrorMsg(e?.message || 'Error cargando productos')
    });
    
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const modelos: any = (client as any).models;
    if (!modelos?.Caja) return;
    
    modelos.Caja.list({ filter: { estado: { eq: 'APERTURA' } }, limit: 1 })
      .then((res: any) => setCajaAbierta(res.data?.[0] ?? null))
      .catch((e: any) => setErrorMsg(e?.message || 'Error buscando caja'));
  }, []);

  const handleProductSelect = (product: Schema["Productos"]["type"]) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productoId === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.productoId === product.id 
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, {
        productoId: product.id,
        descripcion: product.nombre_pruducto!,
        precio_unitario: product.precio!,
        cantidad: 1,
        tipo_item: 'PRODUCTO'
      }];
    });
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    setCart(prev => prev.map((item, i) => 
      i === index ? { ...item, cantidad: newQuantity } : item
    ));
  };

  const handleRemoveItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleCheckout = async () => {
    if (!cajaAbierta) {
      alert('No hay caja en APERTURA');
      return;
    }
    
    if (cart.length === 0) {
      alert('Carrito vacío');
      return;
    }

    const mutaciones: any = (client as any).mutations;
    if (!mutaciones?.crearPOSVentaConDetalles) {
      alert('Mutación crearPOSVentaConDetalles no disponible. Despliega backend.');
      return;
    }

    const args = {
      cajaId: cajaAbierta.id!,
      usuarioVendedorUserId: user?.username || user?.userId || 'desconocido',
      metodo_pago: metodoPago,
      descuento: 0,
      observaciones: "",
      items: cart.map(i => ({
        tipo_item: i.tipo_item,
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    } as any;

    try {
      const res = await mutaciones.crearPOSVentaConDetalles(args);
      if ((res as any).data) {
        const venta = (res as any).data as Schema["POSVenta"]["type"];
        setCart([]);
        alert(`Venta ${venta.numero_ticket} creada. Total S/. ${venta.total?.toFixed(2)}`);
      } else {
        alert('Error creando venta');
      }
    } catch (e: any) {
      alert(e?.message || 'Error creando venta');
    }
  };

  if (errorMsg) {
    return (
      <div className="error-container">
        <div className="error-message">{errorMsg}</div>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <header className="pos-header">
        <div className="header-title">Sistema POS</div>
        <div className="header-user">
          <span>{user?.username}</span>
          <button onClick={signOut} className="signout-btn">Salir</button>
        </div>
      </header>

      {!cajaAbierta && (
        <div className="caja-warning">
          No hay una Caja en APERTURA. Ábrela en Data Manager.
        </div>
      )}

      <div className="pos-content">
        <div className="products-section">
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
          <ProductList
            products={products}
            searchTerm={searchTerm}
            onProductSelect={handleProductSelect}
          />
        </div>

        <div className="cart-section">
          <Cart
            items={cart}
            onQuantityChange={handleQuantityChange}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onCheckout={handleCheckout}
            metodoPago={metodoPago}
            onMetodoPagoChange={setMetodoPago}
          />
        </div>
      </div>
    </div>
  );
};
