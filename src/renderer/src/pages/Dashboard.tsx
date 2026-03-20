import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { DashboardSummary } from '../../../preload';

const pastel = ['#A7CCE5', '#B6D8B8', '#DF9FC3', '#E7E7AE'];
const chartTheme = { grid: '#D9DDD6', text: '#6B7280', line: '#DF9FC3', barPrimary: '#A7CCE5', barSecondary: '#B6D8B8' };

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
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);

    try {
      const resumen = await window.helatte.obtenerDashboard();
      setKpis(resumen.kpis);
      setTablas(resumen.tablas);
      setGraficas(resumen.graficas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
      setKpis(null);
      setTablas(null);
      setGraficas(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const refrisChart = useMemo(() => (graficas ? graficas.refrisAsignadosVsLibres : []), [graficas]);
  const flujoChart = useMemo(() => (graficas ? graficas.ingresosVsEgresos : []), [graficas]);
  const tieneKpisReales = Boolean(
    kpis &&
      (kpis.cajaDia !== 0 ||
        kpis.ventasDia !== 0 ||
        kpis.clientesConAdeudo !== 0 ||
        kpis.refrisAsignados !== 0 ||
        kpis.refrisDisponibles !== 0)
  );
  const tieneTablasReales = Boolean(
    (tablas?.ultimasVentas.length ?? 0) > 0 ||
      (tablas?.clientesSaldo.length ?? 0) > 0 ||
      (tablas?.inventarioBajo.length ?? 0) > 0
  );
  const tieneGraficasReales = Boolean(
    flujoChart.some((item) => item.ingresos > 0 || item.egresos > 0) ||
      refrisChart.some((item) => item.valor > 0)
  );
  const tieneContenido = tieneKpisReales || tieneTablasReales || tieneGraficasReales;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-text/65">Indicadores generales (solo lectura)</p>
        </div>
        <button
          onClick={cargar}
          className="btn btn-secondary"
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
        <p className="text-sm text-text/65">Cargando información...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : tieneContenido ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Ingresos vs egresos (7 días)</h3>
                <span className="text-xs text-text/55">Fuente: movimientos de caja</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={flujoChart}>
                  <XAxis dataKey="fecha" tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid }} tickLine={{ stroke: chartTheme.grid }} />
                  <YAxis tick={{ fill: chartTheme.text, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid }} tickLine={{ stroke: chartTheme.grid }} />
                  <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 16, borderColor: chartTheme.grid, backgroundColor: 'rgba(249,247,240,0.96)', color: '#2F3133' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: chartTheme.text }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill={chartTheme.barPrimary} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="egresos" name="Egresos" fill={chartTheme.barSecondary} radius={[6, 6, 0, 0]} />
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
              <div className="flex justify-between text-sm text-text/65 px-1">
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
        <div className="card p-6 text-sm text-text/65">
          <p className="font-semibold text-text">Sin información para mostrar.</p>
          <p className="mt-1">
            El dashboard real ya no usa datos demo: cuando no hay ventas, clientes, inventario o movimientos,
            se muestra este estado vacío.
          </p>
        </div>
      )}
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-text/65">{title}</p>
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
        {subtitle && <p className="text-xs text-text/55">{subtitle}</p>}
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={`${item.primary}-${idx}`}
              className="flex items-center justify-between rounded-xl border border-borderSoft/80 bg-sky/12 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">{item.primary}</p>
                {item.secondary && <p className="text-xs text-text/65">{item.secondary}</p>}
              </div>
              <div className="text-right">
                {item.badge && <p className="text-xs text-text/65">{item.badge}</p>}
                <p className="font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-borderSoft/80 px-3 py-4 text-sm text-text/55">
          Sin datos disponibles en este módulo.
        </p>
      )}
    </div>
  );
}
