function convert() {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert("Please select a KML or KMZ file");

  const reader = new FileReader();

  if (file.name.endsWith('.kmz')) {
    reader.onload = async function (e) {
      const zip = await JSZip.loadAsync(e.target.result);
      const kmlFile = Object.values(zip.files).find(f => f.name.endsWith('.kml'));
      if (kmlFile) {
        const kmlText = await kmlFile.async('text');
        generateDXF(kmlText);
      } else {
        alert("No KML file found in KMZ.");
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (file.name.endsWith('.kml')) {
    reader.onload = function (e) {
      generateDXF(e.target.result);
    };
    reader.readAsText(file);
  }
}

function kmlColorToDXFIndex(kmlColor) {
  const rgb = kmlColor.match(/.{2}/g).slice(1).reverse();
  const [r, g, b] = rgb.map(x => parseInt(x, 16));
  if (r === 255 && g === 0 && b === 0) return 1;
  if (r === 0 && g === 255 && b === 0) return 3;
  if (r === 0 && g === 0 && b === 255) return 5;
  return 7;
}

function generateDXF(kmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, 'text/xml');
  const placemarks = xml.getElementsByTagName('Placemark');
  const styles = {};
  const dxf = [];

  const styleElements = xml.getElementsByTagName('Style');
  for (let s of styleElements) {
    const id = s.getAttribute('id');
    const colorEl = s.getElementsByTagName('color')[0];
    if (id && colorEl) styles['#' + id] = kmlColorToDXFIndex(colorEl.textContent);
  }

  dxf.push("0\nSECTION\n2\nENTITIES");

  for (let placemark of placemarks) {
    const name = placemark.getElementsByTagName('name')[0]?.textContent || '';
    const styleUrl = placemark.getElementsByTagName('styleUrl')[0]?.textContent.trim();
    const colorIndex = styles[styleUrl] || 7;

    if (name) {
      const coordEl = placemark.querySelector('coordinates');
      if (coordEl) {
        const [x, y] = coordEl.textContent.trim().split(',').map(Number);
        dxf.push(`0\nTEXT\n8\n0\n10\n${x}\n20\n${y}\n30\n0\n40\n60\n1\n${name}`);
      }
    }

    const lineStrings = placemark.getElementsByTagName('LineString');
    for (let line of lineStrings) {
      const coords = line.getElementsByTagName('coordinates')[0].textContent.trim().split(/\s+/);
      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1, z1 = 0] = coords[i].split(',').map(Number);
        const [x2, y2, z2 = 0] = coords[i + 1].split(',').map(Number);
        dxf.push(`0\nLINE\n8\n0\n62\n${colorIndex}\n10\n${x1}\n20\n${y1}\n30\n${z1}\n11\n${x2}\n21\n${y2}\n31\n${z2}`);
      }
    }

    const polygons = placemark.getElementsByTagName('Polygon');
    for (let polygon of polygons) {
      const coords = polygon.getElementsByTagName('outerBoundaryIs')[0]
                    .getElementsByTagName('coordinates')[0]
                    .textContent.trim().split(/\s+/);
      for (let i = 0; i < coords.length; i++) {
        const [x1, y1, z1 = 0] = coords[i].split(',').map(Number);
        const [x2, y2, z2 = 0] = coords[(i + 1) % coords.length].split(',').map(Number);
        dxf.push(`0\nLINE\n8\n0\n62\n${colorIndex}\n10\n${x1}\n20\n${y1}\n30\n${z1}\n11\n${x2}\n21\n${y2}\n31\n${z2}`);
      }
    }
  }

  dxf.push("0\nENDSEC\n0\nEOF");

  const blob = new Blob([dxf.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted_output.dxf';
  a.click();
}
