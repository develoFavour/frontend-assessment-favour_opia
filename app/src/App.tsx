import React, { useMemo, useState, useDeferredValue, useCallback, useRef } from 'react';
import { useURLStore } from './useURLStore';
import { generateOrders, type Order, type Status } from './data';
import { Search, X } from 'lucide-react';
import './styles.css';

// Extracted so the reference remains stable across renders
const ALL_ORDERS = generateOrders(5000);
const STATUSES: Status[] = ['NEW', 'PICKING', 'SHIPPED', 'CANCELLED'];

// We memoize the row component because typing in the search box causes the parent to re-render.
// Since we have 5,000 items, we rely on this to skip re-rendering rows whose props haven't changed.
const OrderRow = React.memo(({ 
  order, 
  isFocused, 
  onClick 
}: { 
  order: Order; 
  isFocused: boolean; 
  onClick: (id: string) => void;
}) => {
  return (
    <tr 
      className={`tr ${isFocused ? 'selected' : ''}`}
      onClick={() => onClick(order.id)}
      id={`row-${order.id}`}
    >
      <td className="td">{order.id}</td>
      <td className="td">{order.customer}</td>
      <td className="td">
        <span className={`status-badge ${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </td>
      <td className="td">${order.total.toFixed(2)}</td>
      <td className="td">{new Date(order.date).toLocaleDateString()}</td>
    </tr>
  );
});

export default function App() {
  const { params, setFilter } = useURLStore();
  const search = params.get('search') || '';

  // Serialize to a primitive so useMemo can compare by value, not reference.
  // params.getAll() returns a new array every render — using the joined string avoids that.
  const statusKey = params.getAll('status').join(',');

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // useDeferredValue ensures the input stays responsive even while React filters the huge list
  const deferredSearch = useDeferredValue(search);

  const filteredOrders = useMemo(() => {
    const needle = deferredSearch.toLowerCase();
    const statuses = statusKey ? statusKey.split(',') : [];
    return ALL_ORDERS.filter(o => {
      const matchSearch = o.id.toLowerCase().includes(needle);
      const matchStatus = statuses.length === 0 || statuses.includes(o.status);
      return matchSearch && matchStatus;
    });
  }, [deferredSearch, statusKey]);

  const focusedOrder = ALL_ORDERS.find(o => o.id === focusedId);

  const handleRowClick = useCallback((id: string) => {
    setFocusedId(id);
    setPanelOpen(true);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredOrders.length === 0) return;
    
    const currentIndex = focusedId ? filteredOrders.findIndex(o => o.id === focusedId) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex < filteredOrders.length - 1 ? currentIndex + 1 : 0;
      setFocusedId(filteredOrders[next].id);
      document.getElementById(`row-${filteredOrders[next].id}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : filteredOrders.length - 1;
      setFocusedId(filteredOrders[prev].id);
      document.getElementById(`row-${filteredOrders[prev].id}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && focusedId) {
      e.preventDefault();
      setPanelOpen(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPanelOpen(false);
      containerRef.current?.focus(); // Return focus to list
    }
  };

  const toggleStatus = (s: Status) => {
    const current = statusKey ? statusKey.split(',') : [];
    const newStatuses = current.includes(s) 
      ? current.filter(x => x !== s)
      : [...current, s];
    setFilter('status', newStatuses);
  };

  return (
    <div className="layout" onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef}>
      <main className="main-content">
        <header className="header">
          <h1>Orders</h1>
          <div className="filters">
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: 8, width: 16, height: 16, color: '#94a3b8' }} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search order number..."
                style={{ paddingLeft: '2rem' }}
                value={search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>
            <div className="status-filters">
              {STATUSES.map(s => (
                <button 
                  key={s}
                  className={`status-btn ${statusKey.split(',').includes(s) ? 'active' : ''}`}
                  onClick={() => toggleStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="th">Order ID</th>
                <th className="th">Customer</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
                <th className="th">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    <div className="empty-state-content">
                      <Search size={32} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
                      <h3>No orders found</h3>
                      <p>We couldn't find any orders matching your current filters.</p>
                      <button 
                        className="clear-btn"
                        onClick={() => {
                          window.history.pushState({}, '', window.location.pathname);
                          window.dispatchEvent(new Event('urlchange'));
                        }}
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <OrderRow 
                    key={order.id} 
                    order={order} 
                    isFocused={focusedId === order.id}
                    onClick={handleRowClick}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {panelOpen && focusedOrder && (
        <aside className="side-panel">
          <div className="side-panel-header">
            <h2>{focusedOrder.id}</h2>
            <button className="close-btn" onClick={() => setPanelOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="side-panel-content">
            <div className="detail-group">
              <span className="detail-label">Customer</span>
              <span className="detail-value">{focusedOrder.customer}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Status</span>
              <span className="detail-value">
                <span className={`status-badge ${focusedOrder.status.toLowerCase()}`}>
                  {focusedOrder.status}
                </span>
              </span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Total Value</span>
              <span className="detail-value">${focusedOrder.total.toFixed(2)}</span>
            </div>
            <div className="detail-group">
              <span className="detail-label">Order Date</span>
              <span className="detail-value">{new Date(focusedOrder.date).toLocaleString()}</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
