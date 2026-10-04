import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Presentation, PresentationFile } from "@oai/artifact-tool";

const directory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(directory, "..", "..", "..");
const buildDir = path.join(directory, ".build-presentation");
const receiptDir = path.join(workspaceDir, ".codex-private");
const outputPath = path.join(directory, "ONO_Prop_Demo_Administracion_Consorcios_Piloto.pptx");
const skillDir = process.env.SKILL_DIR;
const pythonExecutable = process.env.RUNTIME_PYTHON;
if (!skillDir || !pythonExecutable) throw new Error("Faltan SKILL_DIR o RUNTIME_PYTHON");

const { resolvePresentationFont, finalizePresentation } = await import(pathToFileURL(
    path.join(skillDir, "container_tools", "artifact_tool_utils.mjs"),
).href);

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(receiptDir, { recursive: true });
const family = resolvePresentationFont();
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const COLORS = {
    navy: "#071A31",
    teal: "#64E1D2",
    gold: "#FFD37F",
    white: "#F7FBFD",
    muted: "#C8DCE3",
    ink: "#12324B",
};

const logoBytes = await fs.readFile(path.join(workspaceDir, "public", "assets", "img", "logoONOProp3.png"));
const plateBytes = await fs.readFile(path.join(directory, "ONO_Prop_Piloto_Consorcios_WhatsApp.png"));
const heroBytes = await fs.readFile(path.join(directory, "assets", "landing-hero.png"));
const benefitsBytes = await fs.readFile(path.join(directory, "assets", "landing-benefits.png"));
const guideBytes = await fs.readFile(path.join(directory, "assets", "guide-overview.png"));
const pilotBytes = await fs.readFile(path.join(directory, "assets", "landing-pilot.png"));
const finalSceneBytes = await fs.readFile(path.join(directory, "assets", "scene-06.png"));

const addText = (slide, text, position, {
    size = 30,
    color = COLORS.white,
    bold = false,
    align = "left",
} = {}) => {
    const shape = slide.shapes.add({
        geometry: "textbox",
        position,
        fill: "none",
        line: { fill: "none", width: 0 },
    });
    shape.text = text;
    shape.text.style = {
        typeface: family,
        fontSize: size,
        bold,
        color,
        alignment: align,
        autoFit: "shrinkText",
    };
    return shape;
};

const addBackground = (slide) => {
    slide.background.fill = COLORS.navy;
    slide.images.add({
        blob: logoBytes,
        contentType: "image/png",
        alt: "Logo ONO Prop",
        fit: "contain",
        position: { left: 70, top: 36, width: 230, height: 72 },
    });
    addText(slide, "ADMINISTRACIÓN DE CONSORCIOS", {
        left: 890, top: 53, width: 320, height: 30,
    }, { size: 18, color: COLORS.muted, bold: true, align: "right" });
};

const addPage = (slide, page) => addText(slide, `${page} / 6`, {
    left: 1130, top: 676, width: 80, height: 22,
}, { size: 13, color: COLORS.muted, align: "right" });

const addScreenshot = (slide, bytes, alt, position) => slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit: "cover",
    geometry: "roundRect",
    borderRadius: 20,
    position,
});

// 1. Portada
{
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.navy;
    addText(slide, "ADMINISTRACIÓN DE CONSORCIOS", {
        left: 72, top: 105, width: 560, height: 40,
    }, { size: 22, color: COLORS.gold, bold: true });
    addText(slide, "La gestión mensual\nen un solo circuito", {
        left: 72, top: 170, width: 590, height: 165,
    }, { size: 52, bold: true });
    addText(slide, "Demostración comercial\nPiloto acompañado de 30 días", {
        left: 72, top: 365, width: 520, height: 90,
    }, { size: 27, color: COLORS.teal });
    addText(slide, "ONO Prop", {
        left: 72, top: 610, width: 260, height: 42,
    }, { size: 25, color: COLORS.muted, bold: true });
    slide.images.add({
        blob: plateBytes,
        contentType: "image/png",
        alt: "Pieza comercial del piloto de Administración de Consorcios",
        fit: "contain",
        position: { left: 720, top: 35, width: 500, height: 650 },
    });
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 35 segundos.\n\n" +
        "Presentación: ONO Prop reúne el circuito mensual del consorcio dentro de una sola plataforma. " +
        "La demostración se concentra en el trabajo cotidiano del administrador y en la información que reciben propietarios y ocupantes.\n\n" +
        "Fuente: https://onoprop.com/software-administracion-consorcios",
    );
}

// 2. Problema operativo
{
    const slide = presentation.slides.add();
    addBackground(slide);
    addText(slide, "La información se dispersa antes de cerrar el mes", {
        left: 70, top: 128, width: 535, height: 105,
    }, { size: 39, bold: true });
    addText(slide,
        "Cuando pagos, comprobantes, consultas y documentos viven en herramientas separadas, " +
        "el seguimiento depende de tareas manuales.",
        { left: 70, top: 253, width: 520, height: 100 },
        { size: 25, color: COLORS.muted },
    );
    addText(slide,
        "Qué se cobró y qué falta\n\nQué documento respalda cada gasto\n\n" +
        "Qué puede consultar cada consorcista\n\nQué decidió la administración",
        { left: 70, top: 385, width: 520, height: 220 },
        { size: 22, color: COLORS.white, bold: true },
    );
    addScreenshot(slide, heroBytes, "Landing pública del módulo", {
        left: 650, top: 128, width: 560, height: 470,
    });
    addPage(slide, 2);
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 50 segundos.\n\n" +
        "Preguntar cómo trabajan hoy. Identificar cuántas planillas usan, cómo reciben comprobantes y dónde conservan los documentos. " +
        "El objetivo de ONO Prop es conectar esas tareas y conservar el historial, sin quitarle decisiones al administrador.\n\n" +
        "Fuente visual: https://onoprop.com/software-administracion-consorcios",
    );
}

// 3. Circuito administrativo
{
    const slide = presentation.slides.add();
    addBackground(slide);
    addText(slide, "Un circuito une la liquidación con la cuenta corriente", {
        left: 70, top: 128, width: 560, height: 105,
    }, { size: 39, bold: true });
    addText(slide,
        "PREPARAR\nUnidades, cuentas, proveedores y comprobantes\n\n" +
        "LIQUIDAR\nGastos, distribución e intereses\n\n" +
        "COBRAR Y CERRAR\nPagos, recibos, conciliación y archivo",
        { left: 70, top: 260, width: 510, height: 310 },
        { size: 23, color: COLORS.muted, bold: true },
    );
    addScreenshot(slide, benefitsBytes, "Beneficios operativos del módulo", {
        left: 650, top: 128, width: 560, height: 470,
    });
    addPage(slide, 3);
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 55 segundos.\n\n" +
        "Recorrer el mes como una secuencia. Primero se prepara la base, luego se liquida y se comunica. " +
        "Los pagos actualizan las cuentas corrientes y el cierre conserva el respaldo. Mostrar que cada movimiento queda relacionado con su unidad y período.\n\n" +
        "Fuente visual: https://onoprop.com/software-administracion-consorcios",
    );
}

// 4. Portal del consorcista
{
    const slide = presentation.slides.add();
    addBackground(slide);
    addText(slide, "El portal reduce consultas repetidas", {
        left: 70, top: 128, width: 540, height: 100,
    }, { size: 42, bold: true });
    addText(slide,
        "Propietarios y ocupantes ingresan con los permisos definidos por la administración.",
        { left: 70, top: 245, width: 525, height: 78 },
        { size: 25, color: COLORS.muted },
    );
    addText(slide,
        "Estado de cuenta y pagos informados\n\nMensajes a la administración\n\n" +
        "Pólizas, reglamentos y actas\n\nEmergencias e información del edificio",
        { left: 70, top: 360, width: 510, height: 235 },
        { size: 23, color: COLORS.white, bold: true },
    );
    addScreenshot(slide, guideBytes, "Manual público del circuito de consorcios", {
        left: 650, top: 128, width: 560, height: 470,
    });
    addPage(slide, 4);
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 50 segundos.\n\n" +
        "Explicar la diferencia entre propietario y ocupante. El administrador elige qué bloques publica para cada rol. " +
        "El portal centraliza la consulta, pero la administración conserva el control sobre comunicaciones, documentos y permisos.\n\n" +
        "Fuente visual: https://onoprop.com/guias/administracion-consorcios",
    );
}

// 5. Oferta piloto
{
    const slide = presentation.slides.add();
    addBackground(slide);
    addText(slide, "Piloto comercial de 30 días", {
        left: 70, top: 128, width: 530, height: 82,
    }, { size: 44, bold: true });
    addText(slide, "$1.000", {
        left: 70, top: 235, width: 260, height: 90,
    }, { size: 66, color: COLORS.teal, bold: true });
    addText(slide, "por unidad funcional por mes", {
        left: 70, top: 325, width: 445, height: 42,
    }, { size: 25, color: COLORS.white, bold: true });
    addText(slide, "Mínimo mensual: $20.000", {
        left: 70, top: 392, width: 440, height: 42,
    }, { size: 28, color: COLORS.gold, bold: true });
    addText(slide,
        "Demostración inicial gratuita\n\nSin cargos automáticos\n\n" +
        "Primeros tres clientes: alta bonificada y precio promocional durante seis meses, sujeto a disponibilidad",
        { left: 70, top: 468, width: 510, height: 155 },
        { size: 20, color: COLORS.muted },
    );
    addScreenshot(slide, pilotBytes, "Formulario público para solicitar el piloto", {
        left: 650, top: 128, width: 560, height: 470,
    });
    addPage(slide, 5);
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 55 segundos.\n\n" +
        "Aclarar que la demostración no tiene cargo. La solicitud del piloto tampoco activa pagos. " +
        "Luego de relevar el consorcio, ONO Prop envía una propuesta para aceptación expresa. " +
        "El importe mensual estimado surge de la cantidad de unidades y respeta el mínimo promocional.\n\n" +
        "Fuente: https://onoprop.com/software-administracion-consorcios",
    );
}

// 6. Cierre
{
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.navy;
    addText(slide, "PRÓXIMO PASO", {
        left: 72, top: 110, width: 400, height: 38,
    }, { size: 22, color: COLORS.gold, bold: true });
    addText(slide, "Una demostración\ncon un consorcio real", {
        left: 72, top: 175, width: 590, height: 150,
    }, { size: 49, bold: true });
    addText(slide,
        "Revisamos el circuito actual, estimamos la configuración y definimos juntos el alcance del piloto.",
        { left: 72, top: 365, width: 545, height: 105 },
        { size: 26, color: COLORS.muted },
    );
    addText(slide, "onoprop.com/software-administracion-consorcios\ncontacto@onoprop.com", {
        left: 72, top: 535, width: 580, height: 90,
    }, { size: 22, color: COLORS.teal, bold: true });
    slide.images.add({
        blob: finalSceneBytes,
        contentType: "image/png",
        alt: "Llamado a solicitar una demostración con código QR",
        fit: "contain",
        position: { left: 755, top: 35, width: 420, height: 650 },
    });
    addPage(slide, 6);
    slide.speakerNotes.textFrame.setText(
        "Duración sugerida: 35 segundos.\n\n" +
        "Cierre: proponer una demostración breve con datos reales o un consorcio representativo. " +
        "El siguiente paso consiste en relevar unidades, responsables y modalidad de liquidación para preparar la propuesta.\n\n" +
        "Contacto: contacto@onoprop.com\nFuente: https://onoprop.com/software-administracion-consorcios",
    );
}

for (let index = 0; index < presentation.slides.items.length; index++) {
    const slide = presentation.slides.items[index];
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(
        path.join(buildDir, `slide-${String(index + 1).padStart(2, "0")}.png`),
        new Uint8Array(await preview.arrayBuffer()),
    );
}

const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

await finalizePresentation({
    explicitTotalSlideCount: 6,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir,
    candidatePath,
    finalPath: outputPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
    layoutArgs: [
        "--expected-slide-size-emu", "12192000,6858000",
        "--validate-bullet-geometry",
        "--validate-heading-fit",
    ],
    fontPolicy: { basis: "design", families: [family] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(receiptDir, "presentation-validation-consorcios.json"),
});

console.log(JSON.stringify({ outputPath, family }, null, 2));
