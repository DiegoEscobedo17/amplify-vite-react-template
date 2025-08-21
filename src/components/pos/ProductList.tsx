import React from 'react';
import type { Schema } from '../../../amplify/data/resource';

interface ProductListProps {
  products: Array<Schema["Productos"]["type"]>;
  searchTerm: string;
  onProductSelect: (product: Schema["Productos"]["type"]) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  searchTerm,
  onProductSelect,
}) => {
  const filteredProducts = products.filter(product =>
    product.nombre_pruducto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-list">
      <div className="product-grid">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="product-card"
            onClick={() => onProductSelect(product)}
          >
            <div className="product-name">{product.nombre_pruducto}</div>
            <div className="product-price">S/. {product.precio?.toFixed(2)}</div>
            <div className="product-stock">Stock: {product.stock}</div>
          </div>
        ))}
      </div>
      {filteredProducts.length === 0 && (
        <div className="no-products">
          {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
        </div>
      )}
    </div>
  );
};
