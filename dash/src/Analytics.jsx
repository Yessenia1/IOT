import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, Legend, ScatterChart, Scatter, BarChart, Bar, Brush
} from 'recharts';
import { format, subDays, subHours, startOfDay, eachDayOfInterval } from 'date-fns';
import { Download, TrendingUp, Thermometer, AlertTriangle, CloudFog } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label" style={{ fontWeight: 'bold', color: 'white' }}>{label}</p>
        {payload.map((pld, index) => (
          <div key={index} style={{ color: pld.color || pld.fill || 'var(--accent-cyan)', marginBottom: '4px' }}>
            {pld.name}: {typeof pld.value === 'number' ? pld.value.toFixed(2) : pld.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Heatmap Component
const HeatmapCalendar = ({ data, days = 30 }) => {
  const dailyData = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, days - 1);
    const dayRange = eachDayOfInterval({ start, end });
    
    const aggregated = {};
    dayRange.forEach(d => {
      aggregated[format(d, 'yyyy-MM-dd')] = { sum: 0, count: 0, avg: 0 };
    });

    data.forEach(row => {
      if (!row.created_at) return;
      const dayStr = format(new Date(row.created_at), 'yyyy-MM-dd');
      if (aggregated[dayStr]) {
        aggregated[dayStr].sum += row.iaq || 0;
        aggregated[dayStr].count += 1;
      }
    });

    return dayRange.map(d => {
      const dayStr = format(d, 'yyyy-MM-dd');
      const stat = aggregated[dayStr];
      if (stat.count > 0) stat.avg = stat.sum / stat.count;
      
      let color = 'var(--panel-border)';
      if (stat.count > 0) {
        if (stat.avg <= 50) color = 'var(--accent-green)';
        else if (stat.avg <= 100) color = 'var(--accent-yellow)';
        else color = 'var(--accent-red)';
      }
      return { date: dayStr, avg: stat.avg, count: stat.count, color };
    });
  }, [data, days]);

  return (
    <div className="heatmap-grid">
      {dailyData.map((day, i) => (
        <div 
          key={i} 
          className="heatmap-cell" 
          style={{ backgroundColor: day.color, opacity: day.count > 0 ? 0.8 : 0.3 }}
          title={`${day.date}: IAQ Promedio ${Math.round(day.avg)}`}
        >
          {format(new Date(day.date), 'dd')}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [dateRange, setDateRange] = useState('24h'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase.from('grupo5_air_quality').select('*');

      if (dateRange !== 'all') {
        let pastDate;
        if (dateRange === '1h') pastDate = subHours(new Date(), 1).toISOString();
        else if (dateRange === '24h') pastDate = subHours(new Date(), 24).toISOString();
        else if (dateRange === '7d') pastDate = subDays(new Date(), 7).toISOString();
        else if (dateRange === '30d') pastDate = subDays(new Date(), 30).toISOString();
        
        if (dateRange === 'custom') {
          if (startDate && endDate) {
            query = query.gte('created_at', new Date(startDate).toISOString())
                         .lte('created_at', new Date(endDate).toISOString());
          }
        } else {
          query = query.gte('created_at', pastDate);
        }
      }

      query = query.order('id', { ascending: true });
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      const formattedData = (data || []).map(row => {
        const dateObj = row.created_at ? new Date(row.created_at) : new Date(); 
        return {
          ...row,
          formattedTime: row.created_at ? format(dateObj, 'dd/MM HH:mm:ss') : `ID: ${row.id}`,
          formattedDate: row.created_at ? format(dateObj, 'yyyy-MM-dd HH:mm:ss') : `Registro #${row.id}`,
          hour: row.created_at ? parseInt(format(dateObj, 'HH')) : 0
        };
      });
      setHistoryData(formattedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange !== 'custom' || (dateRange === 'custom' && startDate && endDate)) {
      fetchHistory();
    }
    
    const interval = setInterval(() => {
      if (dateRange !== 'custom' || (dateRange === 'custom' && startDate && endDate)) {
        fetchHistory();
      }
    }, 60000); // 1 minuto de auto-refresh

    return () => clearInterval(interval);
  }, [dateRange, startDate, endDate]);

  const filteredData = historyData.filter(row => 
    !searchQuery || (row.id_estacion && row.id_estacion.toLowerCase().includes(searchQuery.toLowerCase())) || row.formattedDate.includes(searchQuery)
  );

  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ["Fecha/Hora", "Estacion", "Temp (C)", "Humedad (%)", "Presion", "Gas", "IAQ", "eCO2", "Sensacion Termica", "Punto Rocio"];
    const csvRows = [headers.join(",")];
    for (const row of filteredData) {
      const values = [
        row.formattedDate, row.id_estacion, row.temperatura?.toFixed(2), row.humedad?.toFixed(2),
        row.presion?.toFixed(2), row.gas?.toFixed(2), row.iaq?.toFixed(2), row.eco2?.toFixed(2),
        row.sensacion_termica?.toFixed(2), row.punto_rocio?.toFixed(2)
      ];
      csvRows.push(values.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${new Date().getTime()}.csv`;
    link.click();
  };

  const hourlyData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => ({ hourStr: `${i}:00`, hour: i, avgIaq: 0, count: 0 }));
    filteredData.forEach(d => {
      hours[d.hour].avgIaq += d.iaq || 0;
      hours[d.hour].count += 1;
    });
    return hours.map(h => ({ ...h, avgIaq: h.count > 0 ? h.avgIaq / h.count : 0 }));
  }, [filteredData]);

  const scatterData = filteredData.map(d => ({ x: d.humedad, y: d.iaq, z: d.gas })).filter(d => d.x && d.y);

  const maxTemp = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.temperatura || 0)) : 0;
  const maxEco2 = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.eco2 || 0)) : 0;
  const avgIaq = filteredData.length > 0 ? (filteredData.reduce((a, c) => a + (c.iaq || 0), 0) / filteredData.length) : 0;

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1rem' }}>Filtro de Fechas y Búsqueda</h3>
        <div className="controls-bar" style={{ alignItems: 'center', marginBottom: 0 }}>
          <select className="control-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="1h">Hace 1 Hora (Zoom Minutos)</option>
            <option value="24h">Último Día (Hoy)</option>
            <option value="7d">Última Semana</option>
            <option value="30d">Último Mes</option>
            <option value="custom">Rango Personalizado...</option>
            <option value="all">Todos (Sin límite)</option>
          </select>
          
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--accent-magenta)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-magenta)' }}>Desde:</span>
              <input type="datetime-local" className="control-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-magenta)' }}>Hasta:</span>
              <input type="datetime-local" className="control-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}

          <input type="text" className="control-input" placeholder="Buscar estación..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flexGrow: 1 }} />
          <button className="control-select" onClick={fetchHistory} style={{cursor: 'pointer', background: 'var(--accent-cyan)', color: 'black', fontWeight: 'bold'}}>Actualizar Datos</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--accent-red)', padding: '1rem', border: '1px solid var(--accent-red)' }}><strong>⚠️ {error}</strong></div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent-cyan)' }}>
          <div className="pulse" style={{ margin: '0 auto', marginBottom: '1rem' }}></div>CARGANDO ANÁLISIS...
        </div>
      ) : (
        <>
          {historyData.length > 0 ? (
            <>
              {/* IAQ OVER TIME (ZOOMABLE STEP CHART) */}
              <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CloudFog color="var(--accent-cyan)" /> Evolución de la Calidad de Aire (IAQ) a lo largo del tiempo
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Desliza las barras horizontales debajo de la gráfica para hacer "Zoom" y ver los datos minuto a minuto.
                </p>
                <div className="chart-container" style={{ height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorIaq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--accent-yellow)" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="formattedTime" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--text-muted)" domain={[0, 500]} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      
                      {/* Step type gives that bar/histogram look you requested */}
                      <Area type="step" dataKey="iaq" name="IAQ" stroke="var(--accent-green)" strokeWidth={2} fillOpacity={1} fill="url(#colorIaq)" />
                      
                      {/* The Brush component allows zooming! */}
                      <Brush dataKey="formattedTime" height={30} stroke="var(--accent-cyan)" fill="rgba(0, 243, 255, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* KPIs & Heatmap */}
              <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <TrendingUp color="var(--accent-cyan)" />
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>IAQ PROMEDIO PERIODO</div><div style={{fontSize:'1.5rem', fontWeight:'bold'}}>{Math.round(avgIaq)}</div></div>
                  </div>
                  <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <AlertTriangle color="var(--accent-yellow)" />
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>PICO MAX eCO2</div><div style={{fontSize:'1.5rem', fontWeight:'bold'}}>{Math.round(maxEco2)} ppm</div></div>
                  </div>
                  <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Thermometer color="var(--accent-magenta)" />
                    <div><div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>TEMP MAX ALCANZADA</div><div style={{fontSize:'1.5rem', fontWeight:'bold'}}>{maxTemp.toFixed(1)}°C</div></div>
                  </div>
                </div>

                <div className="glass-panel">
                  <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>CALENDARIO HEATMAP (IAQ PROMEDIO X DÍA)</h3>
                  <HeatmapCalendar data={filteredData} days={dateRange === '30d' ? 30 : 7} />
                </div>
              </div>

              {/* Advanced Charts Grid */}
              <div className="grid-layout" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                
                {/* Hourly Pattern */}
                <div className="glass-panel">
                  <h3 style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Patrón Promedio por Hora del Día (0-23h)</h3>
                  <div className="chart-container" style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="hourStr" stroke="var(--text-muted)" />
                        <YAxis stroke="var(--text-muted)" />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="avgIaq" name="IAQ Promedio" fill="var(--accent-cyan)" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Plot Correlación */}
                <div className="glass-panel">
                  <h3 style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Correlación del Algoritmo: Humedad vs IAQ</h3>
                  <div className="chart-container" style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="x" name="Humedad" unit="%" stroke="var(--text-muted)" type="number" domain={['auto', 'auto']} />
                        <YAxis dataKey="y" name="IAQ" stroke="var(--text-muted)" type="number" domain={['auto', 'auto']} />
                        <RechartsTooltip cursor={{strokeDasharray: '3 3'}} content={<CustomTooltip />} />
                        <Scatter name="Registros" data={scatterData} fill="var(--accent-magenta)" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
              No se encontraron registros en la base de datos para estas fechas.
            </div>
          )}

          {/* Table */}
          <div className="glass-panel" style={{ padding: '0', marginTop: '1rem' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-main)' }}>Reporte de Registros ({filteredData.length})</h3>
              <button onClick={exportToCSV} className="control-select" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(0, 243, 255, 0.1)', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)' }}>
                <Download size={18} /> Exportar Reporte a Excel / CSV
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Temp (°C)</th>
                    <th>Hum (%)</th>
                    <th>IAQ</th>
                    <th>eCO2</th>
                    <th>Sensación T.</th>
                    <th>Presión</th>
                    <th>Altura</th>
                    <th>Gas</th>
                    <th>VOC</th>
                    <th>P. Rocío</th>
                    <th>Hum. Absoluta</th>
                    <th>Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice().reverse().map((row, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{row.formattedDate}</td>
                      <td>{row.temperatura?.toFixed(1)}</td>
                      <td>{row.humedad?.toFixed(1)}</td>
                      <td><span className={row.iaq > 100 ? 'color-bad' : 'color-good'} style={{ fontWeight: 'bold' }}>{Math.round(row.iaq || 0)}</span></td>
                      <td>{Math.round(row.eco2 || 0)}</td>
                      <td>{row.sensacion_termica?.toFixed(1)}</td>
                      <td>{row.presion?.toFixed(1)}</td>
                      <td>{row.altura !== undefined && row.altura !== null ? row.altura.toFixed(1) : '--'}</td>
                      <td>{row.gas?.toFixed(1)}</td>
                      <td>{row.voc !== undefined && row.voc !== null ? row.voc.toFixed(1) : '--'}</td>
                      <td>{row.punto_rocio?.toFixed(1)}</td>
                      <td>{row.humedad_absoluta?.toFixed(2)}</td>
                      <td>{row.calidad_aire || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
