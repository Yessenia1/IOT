import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Thermometer, Droplets, Wind, Activity, CloudFog, AlertTriangle,
  Clock, HeartPulse, CheckCircle, Sun, Moon, Smile, Meh, Frown, Skull, Info, BookOpen, ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import Analytics from './Analytics';
import './index.css';

const IAQ_LEVELS = [
  { min: 0, max: 50, color: 'var(--accent-green)', text: 'Excelente / Buena', desc: 'La calidad del aire es óptima.', Icon: Smile },
  { min: 51, max: 100, color: 'var(--accent-light-green)', text: 'Buena / Aceptable', desc: 'Calidad del aire aceptable, sin riesgos para la salud.', Icon: Smile },
  { min: 101, max: 150, color: 'var(--accent-yellow)', text: 'Ligeramente Contaminada', desc: 'Se detectan algunos contaminantes. Puede ser perceptible para personas sensibles.', Icon: Meh },
  { min: 151, max: 200, color: 'var(--accent-orange)', text: 'Moderadamente Contaminada', desc: 'Calidad del aire regular. Posibles molestias para grupos sensibles.', Icon: Meh },
  { min: 201, max: 250, color: 'var(--accent-red)', text: 'Altamente Contaminada', desc: 'Calidad del aire mala. Puede afectar a todas las personas con exposición prolongada.', Icon: Frown },
  { min: 251, max: 350, color: 'var(--accent-purple)', text: 'Severamente Contaminada', desc: 'Calidad del aire muy mala. Se recomienda ventilar o reducir actividades.', Icon: Skull },
  { min: 351, max: 500, color: 'var(--accent-black)', text: 'Extremadamente Contaminada', desc: 'Calidad del aire peligrosa. Condiciones de riesgo para la salud.', Icon: Skull },
];

const getIaqInfo = (iaqValue) => {
  const val = Math.min(Math.max(iaqValue || 0, 0), 500);
  return IAQ_LEVELS.find(l => val >= l.min && val <= l.max) || IAQ_LEVELS[0];
};

// Generic Gauge Component
const MetricGauge = ({ value, min = 0, max = 100, unit = '', title, color = 'var(--accent-cyan)', large = false }) => {
  const normalizedValue = Math.min(Math.max(value || 0, min), max);
  const percentage = ((normalizedValue - min) / (max - min)) * 100;

  const r = large ? 95 : 65;
  const strokeWidth = large ? 16 : 12;
  const cx = large ? 110 : 80;
  const cy = large ? 105 : 75;
  const width = large ? 220 : 160;
  const height = large ? 115 : 85;

  const strokeDasharray = Math.PI * r;
  const strokeDashoffset = strokeDasharray - (percentage / 100) * strokeDasharray;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '1px' }}>
        {title}
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--panel-border)" strokeWidth={strokeWidth} strokeLinecap="round" />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: large ? '50px' : '28px', left: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: large ? '3.5rem' : '1.4rem', fontWeight: 'bold', color: 'var(--text-main)', fontFamily: 'JetBrains Mono, monospace' }}>
            {value !== undefined && value !== null ? Number(value).toFixed(1).replace('.0', '') : '--'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: `${r * 2}px`, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
        <span>{min}</span>
        <span style={{ fontWeight: 'bold' }}>{unit}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

const IaqMainGauge = ({ iaq }) => {
  const info = getIaqInfo(iaq);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <MetricGauge value={iaq} min={0} max={500} title="OVERALL INDEX (IAQ)" color={info.color} large={true} unit="IAQ" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: info.color }}>
        <info.Icon size={24} />
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{info.text}</span>
      </div>
    </div>
  );
};


function HealthAssistant({ data }) {
  if (!data) return null;
  const alerts = [];
  const iaqInfo = getIaqInfo(data.iaq);

  if (data.eco2 > 1000) {
    alerts.push({ type: 'danger', message: 'Niveles altos de CO2 detectados. Recomendación: Ventilar la habitación inmediatamente.' });
  }

  if (data.iaq > 150) {
    alerts.push({ type: 'danger', message: `Calidad de aire: ${iaqInfo.text}. ${iaqInfo.desc}` });
  } else if (data.iaq > 100) {
    alerts.push({ type: 'warning', message: `Atención: ${iaqInfo.text}. ${iaqInfo.desc}` });
  }

  if (data.humedad < 30) {
    alerts.push({ type: 'warning', message: 'Ambiente seco. Recomendación: Usar un humidificador.' });
  } else if (data.humedad > 65) {
    alerts.push({ type: 'warning', message: 'Alta humedad. Riesgo de moho. Usa un deshumidificador.' });
  }

  if (data.temperatura > 30) {
    alerts.push({ type: 'danger', message: 'Alerta por calor extremo. Mantente hidratado.' });
  } else if (data.temperatura < 15) {
    alerts.push({ type: 'warning', message: 'Temperatura por debajo de la zona de confort. Abrígate bien.' });
  }

  if (data.temperatura && data.punto_rocio && (data.temperatura - data.punto_rocio) <= 1.5) {
    alerts.push({ type: 'danger', message: 'Alto riesgo de condensación. Temperatura muy cercana al punto de rocío.' });
  }

  return (
    <div className="glass-panel" style={{ gridColumn: '1 / -1', marginTop: '1rem', border: alerts.length > 0 ? '1px solid var(--accent-red)' : '1px solid var(--accent-green)' }}>
      <div className="metric-header" style={{ color: 'var(--text-main)' }}>
        <HeartPulse className="metric-icon" size={24} color={alerts.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)'} />
        <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>ASISTENTE INTELIGENTE DE SALUD AMBIENTAL</span>
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {alerts.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)' }}>
            <CheckCircle size={20} />
            <span><strong>¡Entorno Óptimo!</strong> Condiciones perfectas de confort y salud.</span>
          </div>
        ) : (
          alerts.map((alert, index) => (
            <div key={index} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              background: alert.type === 'danger' ? 'rgba(255, 51, 51, 0.1)' : 'rgba(255, 204, 0, 0.1)',
              padding: '1rem', borderRadius: '8px',
              borderLeft: `4px solid ${alert.type === 'danger' ? 'var(--accent-red)' : 'var(--accent-yellow)'}`
            }}>
              <AlertTriangle size={20} color={alert.type === 'danger' ? 'var(--accent-red)' : 'var(--accent-yellow)'} style={{ flexShrink: 0 }} />
              <span style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>{alert.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LiveMonitor({ data, loading, error }) {
  if (error) {
    return (
      <div style={{ color: 'var(--accent-red)', padding: '1rem', border: '1px solid var(--accent-red)', borderRadius: '8px' }}>
        <strong>SYSTEM ERROR:</strong> {error}
      </div>
    );
  }

  let timestampDisplay = 'Esperando conexión...';
  let isOffline = false;
  if (data) {
    const dataTime = data.created_at ? new Date(data.created_at) : new Date();
    timestampDisplay = format(dataTime, 'dd/MM/yyyy HH:mm:ss');
    if ((new Date() - dataTime) > 300000) isOffline = true;
  }

  const isDanger = data && (data.iaq > 150 || data.eco2 > 1500);
  const iaqData = data ? getIaqInfo(data.iaq) : null;

  return (
    <>
      {isDanger && (
        <div style={{ background: 'var(--accent-red)', color: 'white', padding: '1rem', textAlign: 'center', fontWeight: 'bold', borderRadius: '8px', marginBottom: '1rem' }}>
          ⚠️ ALERTA: LA CALIDAD DEL AIRE ES {iaqData?.text.toUpperCase()}. TOMA PRECAUCIONES.
        </div>
      )}

      <main className={`grid-layout ${isDanger ? 'danger-pulse' : ''}`} style={{ marginTop: '1rem' }}>
        <HealthAssistant data={data} />

        <div className="glass-panel main-iaq-panel">
          <IaqMainGauge iaq={data?.iaq} />

          {data && (
            <div style={{ marginTop: '2rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--panel-bg)', padding: '0.5rem 1rem',
                borderRadius: '8px', border: `1px solid ${isOffline ? 'var(--accent-yellow)' : 'var(--panel-border)'}`
              }}>
                <Clock size={16} color={isOffline ? 'var(--accent-yellow)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '0.9rem', color: isOffline ? 'var(--accent-yellow)' : 'var(--text-main)' }}>
                  {isOffline ? 'SENSOR INACTIVO (Último dato: ' : 'Última actualización: '}
                  <strong>{timestampDisplay}</strong>
                  {isOffline && ')'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Other Metrics as Gauges */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MetricGauge value={data?.temperatura} min={0} max={50} unit="°C" title="Temperatura" color="var(--accent-magenta)" />
          {data?.sensacion_termica && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>Sensación: {data.sensacion_termica.toFixed(1)}°C</div>}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MetricGauge value={data?.humedad} min={0} max={100} unit="%" title="Humedad" color="var(--accent-cyan)" />
          {data?.humedad_absoluta && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>Absoluta: {data.humedad_absoluta.toFixed(2)} g/m³</div>}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MetricGauge value={data?.presion} min={600} max={1100} unit="hPa" title="Presión" color="#0055ff" />
          {data?.punto_rocio && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>Punto Rocío: {data.punto_rocio.toFixed(1)}°C</div>}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MetricGauge value={data?.gas} min={0} max={500} unit="KΩ" title="Resistencia de Gas" color="var(--accent-purple)" />
          {data?.calidad_aire && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>DB: {data.calidad_aire}</div>}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <MetricGauge value={data?.eco2} min={400} max={5000} unit="ppm" title="eCO2 (Estimado)" color="var(--accent-yellow)" />
        </div>
      </main>
    </>
  );
}

function InformationTab() {
  return (
    <div className="grid-layout" style={{ gridTemplateColumns: '1fr', marginTop: '1rem' }}>

      {/* SECCIÓN IAQ */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CloudFog color="var(--accent-cyan)" /> Índice de Calidad del Aire (IAQ)
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          El IAQ se calcula a partir de los compuestos orgánicos volátiles (VOC) detectados por el sensor de gas.
          Un valor menor indica un aire más limpio.
        </p>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rango IAQ</th>
                <th>Clasificación</th>
                <th>Recomendación y Efectos en la Salud</th>
              </tr>
            </thead>
            <tbody>
              {IAQ_LEVELS.map((level, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}>{level.min} - {level.max}</td>
                  <td>
                    <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '4px', background: level.color, color: level.color === 'var(--accent-light-green)' || level.color === 'var(--accent-yellow)' ? 'black' : 'white', fontWeight: '600' }}>
                      {level.text}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{level.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MITIGACIÓN */}
      <div className="glass-panel" style={{ border: '1px solid var(--accent-magenta)' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert color="var(--accent-magenta)" /> Estrategias de Mitigación (Qué hacer en crisis)
        </h2>
        <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <li>
            <strong style={{ color: 'var(--accent-orange)' }}>Niveles Moderados (IAQ 150-200 / CO2 &gt; 1000ppm):</strong>
            Abre ventanas y puertas opuestas para crear ventilación cruzada durante al menos 15-20 minutos. Si estás cocinando, enciende la campana extractora.
          </li>
          <li>
            <strong style={{ color: 'var(--accent-red)' }}>Niveles Severos (IAQ &gt; 250 / CO2 &gt; 1500ppm):</strong>
            Evacúa temporalmente la habitación si sientes mareos o dolor de cabeza. Enciende purificadores de aire con filtro HEPA y carbón activado para remover VOCs (Gases Orgánicos). Detén cualquier actividad de combustión (estufas, velas).
          </li>
          <li>
            <strong style={{ color: 'var(--accent-cyan)' }}>Problemas de Humedad (&gt;65%):</strong>
            La alta humedad potencia la sensación de mala calidad de aire y prolifera moho. Usa un deshumidificador o aire acondicionado en modo "Dry". Evita secar ropa en el interior.
          </li>
        </ul>
      </div>

      {/* SECCIÓN TEMPERATURA */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Thermometer color="var(--accent-magenta)" /> Niveles de Temperatura
        </h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rango (°C)</th>
                <th>Estado</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 'bold' }}>Menos de 15 °C</td><td><span style={{ color: 'var(--accent-cyan)' }}>❄️ Frío</span></td><td style={{ color: 'var(--text-muted)' }}>Fuera de la zona de confort térmico ideal para interiores.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>15 °C - 24 °C</td><td><span style={{ color: 'var(--accent-green)' }}>✅ Confortable</span></td><td style={{ color: 'var(--text-muted)' }}>Temperatura ideal y óptima para el cuerpo humano en reposo o trabajo de oficina.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>25 °C - 30 °C</td><td><span style={{ color: 'var(--accent-yellow)' }}>☀️ Cálido</span></td><td style={{ color: 'var(--text-muted)' }}>Puede generar ligera incomodidad y sudoración dependiendo de la humedad.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Más de 30 °C</td><td><span style={{ color: 'var(--accent-red)' }}>🔥 Calor Extremo</span></td><td style={{ color: 'var(--text-muted)' }}>Riesgo de deshidratación y agotamiento térmico si la exposición es prolongada.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN HUMEDAD */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Droplets color="var(--accent-cyan)" /> Niveles de Humedad Relativa
        </h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rango (%)</th>
                <th>Estado</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 'bold' }}>Menos del 30%</td><td><span style={{ color: 'var(--accent-yellow)' }}>🌵 Muy Seco</span></td><td style={{ color: 'var(--text-muted)' }}>Puede causar irritación en vías respiratorias, piel seca y molestias en los ojos.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>30% - 60%</td><td><span style={{ color: 'var(--accent-green)' }}>✅ Confortable</span></td><td style={{ color: 'var(--text-muted)' }}>Humedad ideal para la salud y preservación del mobiliario interior.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Más del 60%</td><td><span style={{ color: 'var(--accent-red)' }}>💧 Muy Húmedo</span></td><td style={{ color: 'var(--text-muted)' }}>Alto riesgo de proliferación de moho, ácaros y condensación en paredes.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN eCO2 */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity color="var(--accent-yellow)" /> Niveles de Dióxido de Carbono Estimado (eCO2)
        </h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rango (ppm)</th>
                <th>Estado</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ fontWeight: 'bold' }}>Menos de 600</td><td><span style={{ color: 'var(--accent-green)' }}>🌲 Excelente</span></td><td style={{ color: 'var(--text-muted)' }}>Niveles comparables al aire fresco exterior. Óptima ventilación.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>600 - 1000</td><td><span style={{ color: 'var(--accent-light-green)' }}>👍 Aceptable</span></td><td style={{ color: 'var(--text-muted)' }}>Típico de espacios interiores ocupados con buena circulación de aire.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>1000 - 1500</td><td><span style={{ color: 'var(--accent-orange)' }}>⚠️ Ventilación Necesaria</span></td><td style={{ color: 'var(--text-muted)' }}>Comienza a causar sensación de "aire viciado" y somnolencia leve.</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Más de 1500</td><td><span style={{ color: 'var(--accent-red)' }}>⛔ Peligroso</span></td><td style={{ color: 'var(--text-muted)' }}>Puede causar dolor de cabeza, pérdida de concentración y fatiga intensa.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* OTRAS MÉTRICAS FÍSICAS */}
      <div className="glass-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--accent-purple)' }}>
          <Activity size={24} />
          Resistencia de Gas (BME680) y VOCs
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1rem' }}>
          El sensor <strong>BME680</strong> contiene un componente semiconductor (placa caliente) cuya resistencia eléctrica cambia cuando entra en contacto con <strong>Compuestos Orgánicos Volátiles (VOCs)</strong>.
        </p>
        <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <li><strong style={{ color: 'var(--accent-green)' }}>Mayor Resistencia (ej. &gt; 50 KΩ):</strong> Indica aire limpio. Hay pocos gases contaminantes que reaccionen con el sensor.</li>
          <li><strong style={{ color: 'var(--accent-red)' }}>Menor Resistencia (ej. &lt; 10 KΩ):</strong> Indica aire contaminado. Altas concentraciones de gases (VOCs) reducen la resistencia del sensor.</li>
        </ul>
        <div style={{ padding: '1rem', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1rem' }}>¿Qué son los VOCs?</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Son gases emitidos por ciertos sólidos o líquidos, incluyendo químicos de limpieza, pinturas, disolventes, humo de tabaco, e incluso bio-efluentes humanos. Son los principales responsables de que "huela a cerrado" o a contaminación química.
          </p>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#0055ff' }}>
          <Wind size={24} />
          Presión Atmosférica y Altitud
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1rem' }}>
          La <strong>presión atmosférica</strong> (medida en hectopascales - hPa) es el peso que ejerce el aire sobre nosotros. El sensor BME680 es tan preciso que puede medir cambios de presión equivalentes a subir o bajar un solo escalón.
        </p>
        <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong style={{ color: 'var(--text-main)' }}>Nivel del Mar:</strong> ~1013.25 hPa estándar.</li>
          <li><strong style={{ color: 'var(--text-main)' }}>Relación con Altura:</strong> A mayor altitud, hay menos capa de aire encima, por lo tanto, <strong>menor presión</strong>. El algoritmo calcula tu <strong>Altura Estimada</strong> basándose en esta caída de presión.</li>
          <li><strong style={{ color: 'var(--text-main)' }}>Predicción del Clima:</strong>
            <br />- Si la presión <em>baja rápidamente</em>, significa que se acerca un frente frío o lluvia (borrasca).
            <br />- Si la presión <em>sube o se mantiene alta</em>, indica buen clima, cielos despejados y estables (anticiclón).
          </li>
        </ul>
      </div>

      <div className="glass-panel" style={{ borderTop: '4px solid var(--accent-magenta)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
          <Info size={24} color="var(--accent-magenta)" />
          Humedad Absoluta y Conceptos Termodinámicos
        </h2>
        <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', listStylePosition: 'inside', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <li>
            <strong style={{ color: 'var(--text-main)' }}>Punto de Rocío (Dew Point):</strong> Es la temperatura a la que debe enfriarse el aire para condensarse.
          </li>
          <li>
            <strong style={{ color: 'var(--text-main)' }}>Sensación Térmica (Heat Index):</strong> Cómo el cuerpo humano percibe la temperatura ambiental combinando aire y humedad.
          </li>
        </ul>
      </div>

    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    if (lightMode) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
  }, [lightMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: latestData, error: fetchError } = await supabase
        .from('grupo5_air_quality')
        .select('*')
        .order('id', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (latestData && latestData.length > 0) setData(latestData[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh garantizado cada 5 segundos para el Live Monitor
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="scanline"></div>
      <div className="dashboard-container">
        <header>
          <div className="title-container">
            <h1>Nexus AQ System</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setLightMode(!lightMode)}
              style={{ background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}
            >
              {lightMode ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <div className="status-indicator">
              <div className={`pulse ${!data ? 'offline' : ''}`} style={!data ? { backgroundColor: 'var(--accent-red)', animation: 'none' } : {}}></div>
              {loading && !data ? 'INITIALIZING...' : 'ACTIVE'}
            </div>
          </div>
        </header>

        <nav className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
            Monitor en Vivo
          </button>
          <button className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            Análisis Histórico
          </button>
          <button className={`nav-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
            Guía de Calidad del Aire &amp; Información
          </button>
        </nav>

        {activeTab === 'live' && <LiveMonitor data={data} loading={loading} error={error} />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'info' && <InformationTab />}
      </div>
    </>
  );
}

export default App;
