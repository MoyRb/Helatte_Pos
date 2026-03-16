import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { DashboardSummary } from '../../../preload';

const pastel = ['#F72585', '#FFD6E7', '#111111', '#FF5FA2'];

const money = (value: number) =>
  value.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardSummary['kpis'] | null>(null);
  const [tablas, setTablas] = useState<DashboardSummary['tablas'] | null>(null);
  const [graficas, setGraficas] = useState<DashboardSummary['graficas'] | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);

    const [kpisResult, tablasResult, graficasResult] = await Promise.allSettled([
      window.helatte.obtenerDashboard().then((res) => res.kpis),
      window.helatte.obtenerDashboard().then((res) => res.tablas),
      window.helatte.obtenerDashboard().then((res) => res.graficas)
    ]);

    setKpis((prev) => (kpisResult.status === 'fulfilled' ? kpisResult.value : prev));
    setTablas((prev) => (tablasResult.status === 'fulfilled' ? tablasResult.value : prev));
    setGraficas((prev) => (graficasResult.status === 'fulfilled' ? graficasResult.value : prev));

    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const refrisChart = useMemo(() => (graficas ? graficas.refrisAsignadosVsLibres : []), [graficas]);
  const flujoChart = useMemo(() => (graficas ? graficas.ingresosVsEgresos : []), [graficas]);
  const tieneContenido = Boolean(kpis || tablas || graficas);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">Indicadores generales (solo lectura)</p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/60 bg-white hover:bg-primary/20 text-sm"
        >
          <RefreshCcw size={16} /> Recargar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <DashboardCard title="Caja del día" value={kpis ? money(kpis.cajaDia) : '--'} />
        <DashboardCard title="Ventas POS del día" value={kpis ? money(kpis.ventasDia) : '--'} />
        <DashboardCard title="Clientes con adeudo" value={kpis ? kpis.clientesConAdeudo : '--'} />
        <DashboardCard title="Refris asignados" value={kpis ? kpis.refrisAsignados : '--'} />
        <DashboardCard title="Refris disponibles" value={kpis ? kpis.refrisDisponibles : '--'} />
      </div>

      {cargando ? (
        <p className="text-sm text-gray-600">Cargando información...</p>
      ) : tieneContenido ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Ingresos vs egresos (7 días)</h3>
                <span className="text-xs text-gray-500">Fuente: movimientos de caja</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={flujoChart}>
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => money(value)} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#F72585" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="egresos" name="Egresos" fill="#111111" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold mb-3">Refris asignados vs libres</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={refrisChart} dataKey="valor" nameKey="label" outerRadius={90} label>
                    {refrisChart.map((_, i) => (
                      <Cell key={i} fill={pastel[i % pastel.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-between text-sm text-gray-600 px-1">
                {refrisChart.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: pastel[refrisChart.indexOf(item) % pastel.length] }}
                    />
                    {item.label}: {item.valor}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DataCard
              title="Últimas ventas POS"
              subtitle="Folio, método y total"
              items={(tablas?.ultimasVentas ?? []).map((venta) => ({
                primary: venta.folio,
                secondary: new Date(venta.fecha).toLocaleString('es-MX'),
                badge: venta.pagoMetodo,
                value: money(venta.total)
              }))}
            />

            <DataCard
              title="Clientes con mayor saldo"
              subtitle="Top 5"
              items={(tablas?.clientesSaldo ?? []).map((cliente) => ({
                primary: cliente.nombre,
                secondary: cliente.telefono ?? 'Sin teléfono',
                badge: cliente.estado,
                value: money(cliente.saldo)
              }))}
            />

            <DataCard
              title="Inventario bajo"
              subtitle="Menor stock"
              items={(tablas?.inventarioBajo ?? []).map((producto) => ({
                primary: producto.sabor.nombre,
                secondary: producto.tipo.nombre,
                badge: producto.presentacion,
                value: producto.stock
              }))}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Sin información para mostrar.</p>
      )}
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DataCard({
  title,
  subtitle,
  items
}: {
  title: string;
  subtitle?: string;
  items: { primary: string; secondary?: string; badge?: string; value: string | number }[];
}) {
  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={`${item.primary}-${idx}`}
            className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2 text-sm"
          >
            <div>
              <p className="font-semibold">{item.primary}</p>
              {item.secondary && <p className="text-xs text-gray-600">{item.secondary}</p>}
            </div>
            <div className="text-right">
              {item.badge && <p className="text-xs text-gray-600">{item.badge}</p>}
              <p className="font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
