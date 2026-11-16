# Dashboard de captación y seguimiento comercial · Eduqia

Dashboard web estático basado en `plantilla-final.xlsx`, preparado para alojarse en **GitHub Pages**. No requiere backend, base de datos ni compilación. Diseño responsive y cinco áreas: visión general, captación y leads, matrículas, inversión y objetivos, operaciones y calidad.

> **Estado de la fuente original:** el Excel proporcionado es una plantilla maestra sin registros de captación, matrículas ni inversión. Por defecto, el dashboard muestra estados vacíos reales. No contiene cifras de ejemplo ni métricas inventadas.

## 1. Abrirlo en local

Sitúate dentro de la carpeta descargada y ejecuta:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`. También puedes utilizar la extensión *Live Server* de VS Code. No se recomienda abrir `index.html` directamente por el protocolo `file://`, ya que no carga el archivo JSON inicial de forma fiable.

Para **importar archivos Excel** hace falta conexión a Internet: el navegador carga la biblioteca de lectura XLSX desde jsDelivr y, si falla, Cloudflare. La visualización y los cálculos del dashboard se ejecutan en el propio dispositivo y no envían los datos del Excel a un servidor.

## 2. Subirlo a GitHub Pages

1. Crea un repositorio de GitHub, por ejemplo `dashboard-eduqia`.
2. Sube a su raíz **todos los archivos de esta carpeta**, respetando la estructura de `data/datos.json` (no subas solamente el ZIP).
3. En el repositorio, entra en **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarda.
5. Accede a `https://TU-USUARIO.github.io/dashboard-eduqia/` cuando GitHub termine de publicar.

**Aviso de privacidad:** GitHub Pages suele ofrecer el contenido de la web públicamente, incluso en configuraciones donde el repositorio no es público. Antes de publicar `data/datos.json`, comprueba que no contenga nombres de personas, notas internas, información de clientes o datos comerciales confidenciales que no deban hacerse públicos. Si necesitas un dashboard privado con acceso por usuario, requerirá otra solución de hosting y autenticación.

## 3. Actualizar los datos

**Opción A · Carga puntual en el navegador.** Pulsa **Cargar Excel**, selecciona una copia cumplimentada de la plantilla y consulta los resultados. Esta importación se procesa localmente, no modifica el archivo fuente ni se publica ni se guarda entre sesiones. Cada persona debe cargar su copia de Excel al abrir el dashboard.

**Opción B · Datos publicados con GitHub.** Tras cargar el archivo cumplimentado, pulsa **Exportar datos**. Se descargará `datos.json`. Sustituye `data/datos.json` en el repositorio por este nuevo archivo y confirma el cambio (*commit*). GitHub Pages mostrará esos datos al abrir el dashboard sin volver a importar el Excel. **Solo realiza este paso si la publicación de los datos está autorizada.** El JSON exportado puede contener datos comerciales, responsables de acciones y otros detalles presentes en las pestañas fuente; revísalo antes de subirlo.

Para proyectos con datos sensibles, utiliza la opción A sin publicar el JSON, o plantea un hosting privado con autenticación.

## 4. Estructura del proyecto

```text
dashboard-eduqia/
├── index.html           # estructura y navegación
├── styles.css           # diseño responsive
├── app.js               # interfaz, filtros, gráficas e importación
├── engine.mjs           # cálculos, limpieza y agregaciones
├── favicon.svg
├── data/
│   └── datos.json       # snapshot publicado (vacío por defecto)
├── tests/
│   └── engine.test.mjs  # pruebas de métricas
└── README.md
```

Pruebas de lógica con Node 18+:

```bash
node tests/engine.test.mjs
node tests/import.test.mjs
node tests/ui-smoke.mjs
```

## 5. Hojas del Excel utilizadas

| Pestaña | Uso |
| --- | --- |
| **Datos semanales** | Leads, estados, indicadores de contacto e interés, controles de cuadre |
| **Matriculas** | Nuevas matrículas por semana, programa, tipo y origen |
| **Detalle leads** | Recuentos independientes por origen y programa (no se vuelven a sumar al total semanal) |
| **Inversión y objetivos** | Inversión, CPL, coste agregado por matrícula, objetivos e ingresos comunicados |
| **Acciones** | Listado de acciones, responsables y estado |
| **Correspondencia** | Se conserva en el snapshot; relación declarada entre estado CRM y estado de informe |

**La importación requiere las pestañas «Datos semanales» y «Matriculas»**; las otras son opcionales. No modifiques los nombres de los encabezados de la plantilla.

La pestaña «Detalle leads» no incluye columna `Cliente`. Si el Excel agrupa varios clientes, los registros de detalle no se asignan arbitrariamente a un centro. Para análisis exacto, utiliza una copia de la plantilla por centro. Se evitan los campos de identificación personal de leads porque no están contemplados en la estructura fuente.

## 6. Definiciones y límites

- **Leads válidos** = leads – falsos.
- **Contactados total** = contactados + interesados + no interesados + stand by.
- **% contacto** = contactados total / leads válidos.
- **% interés** = interesados / contactados total.
- **Interés sobre válidos** = interesados / leads válidos. En el Excel también se llama «% conversión», pero aquí se utiliza una etiqueta menos ambigua.
- **% falsos** = falsos / leads.
- **Matrículas** = suma de nuevas matrículas registradas, no el acumulado previo de cada semana.
- **CPL** = inversión / leads recibidos del periodo. **Coste por matrícula** = inversión / matrículas registradas del periodo, sujeto a cobertura de datos. No es atribución individual.
- **Ingresos / inversión** es un cociente agregado y no un ROI causal ni el beneficio neto.
- **Objetivos** = suma de objetivos semanales informados en el periodo seleccionado.
- **Sin dato ≠ cero**. Si no se han registrado matrículas, inversión o ingresos, se muestran como no informados. En los gráficos las semanas sin matrícula declarada quedan vacías.
- Los ratios de los periodos se recalculan a partir de sumas de numeradores y denominadores; no se promedian tasas semanales.
- La comparativa semanal utiliza las dos semanas naturales consecutivas respecto al corte seleccionado.
- Los gráficos de vista general muestran un máximo de 12 semanas y los de áreas específicas hasta 26; el resto de los indicadores suma todo el periodo seleccionado.
- El formato de fecha esperado para las semanas es un lunes en Excel. Las fechas se filtran como fechas calendario; no se reetiquetan automáticamente a lunes.
- Los controles de consistencia detectan descuadres de los seis estados frente al total de leads, valores negativos y semanas repetidas por cliente. No garantizan ausencia de duplicados individuales: la plantilla no trae emails ni IDs de lead en la pestaña de detalle.
- Si una semana contiene inversión, pero no cuenta con captación o matrículas, los costes correspondientes quedan sin calcular.

## 7. Siguiente evolución posible

Para un uso continuado por múltiples centros, lo siguiente sería introducir un almacén de datos privado, autenticación y una actualización automatizada desde Google Sheets/CRM. **GitHub Pages por sí solo no recibe ni guarda automáticamente archivos Excel**: la carga local se pierde al cerrar la sesión, salvo que publiques el JSON como se explica arriba.
Publicación del dashboard.
