import React from 'react';

interface CartItem {
  id?: string;
  descripcion: string;
  precio_unitario: number;
  cantidad: number;
  tipo_item: 'PRODUCTO' | 'SERVICIO';
  productoId?: string;
}

interface CartProps {
  items: CartItem[];
  onQuantityChange: (index: number, newQuantity: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  metodoPago: string;
  onMetodoPagoChange: (metodo: string) => void;
}

export const Cart: React.FC<CartProps> = ({
  items,
  onQuantityChange,
  onRemoveItem,
  onClearCart,
  onCheckout,
  metodoPago,
  onMetodoPagoChange,
}) => {
  const total = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

  return (
    <div className="cart">
      <div className="cart-header">
        <h3>Carrito de Compras</h3>
        <div className="cart-total">Total: S/. {total.toFixed(2)}</div>
      </div>

      <div className="cart-items">
        {items.map((item, index) => (
          <div key={index} className="cart-item">
            <div className="item-info">
              <div className="item-name">{item.descripcion}</div>
              <div className="item-price">S/. {item.precio_unitario.toFixed(2)}</div>
            </div>
            <div className="item-controls">
              <button
                onClick={() => onQuantityChange(index, Math.max(1, item.cantidad - 1))}
                className="quantity-btn"
              >
                -
              </button>
              <span className="quantity">{item.cantidad}</span>
              <button
                onClick={() => onQuantityChange(index, item.cantidad + 1)}
                className="quantity-btn"
              >
                +
              </button>
              <button
                onClick={() => onRemoveItem(index)}
                className="remove-btn"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <div className="payment-method">
            <label>Método de Pago:</label>
            <select
              value={metodoPago}
              onChange={(e) => onMetodoPagoChange(e.target.value)}
            >
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TARJETA">TARJETA</option>
              <option value="YAPE">YAPE</option>
              <option value="PLIN">PLIN</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            </select>
          </div>

          <div className="cart-actions">
            <button onClick={onClearCart} className="clear-btn">
              LIMPIAR
            </button>
            <button onClick={onCheckout} className="checkout-btn">
              COBRAR
            </button>
          </div>
        </>
      )}
    </div>
  );
};
