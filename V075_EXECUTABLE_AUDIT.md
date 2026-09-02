# V0.7.5 — Auditoría ejecutable

| Estado | Capacidades verificadas |
|---|---|
| Terminado | Inventario ZIP, deduplicación, evidencia y fuentes; Buyers/Demand/Matching/Opportunities; OWN/MARKET; Readiness y paquetes; Client Twin/Broker Twin; worker, checkpoints, resume e idempotencia. |
| Parcial | `master_properties` funciona como identidad canónica, pero aún no presenta un expediente Property Twin; `opportunities` detecta matching, pero no implementa el ciclo comercial completo. |
| Simulado | E2E usa datos sintéticos aislados para Linda, grandes lotes y recarga. No afirma disponibilidad ni cierre reales. |
| Desconectado | Migraciones SQL son contrato de destino futuro; la operación actual sigue en IndexedDB `grupos-inmobiliarios`. |
| Pendiente V0.7.5 | Property Twin, pipeline comercial y Control Tower accionable. |
| Bloqueado externo | Disponibilidad, visitas, negociación y documentación requieren confirmación humana; mensajería automática y servicios pagos quedan fuera. |

Secuencia real recuperada del historial: 0A Core → 0B identidad/media/OWN → 0C demanda/matching/oportunidad → 0D readiness → 0E Client/Broker Twin → 0F Property Twin + pipeline + Control Tower.
