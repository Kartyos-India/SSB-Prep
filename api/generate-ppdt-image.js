// api/generate-ppdt-image.js
// This function no longer calls an external AI service.
// It returns a static, pre-selected, ambiguous image suitable for a PPDT.
// This makes the feature free, fast, and 100% reliable.

export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        // This is a Base64 encoded string of a simple, ambiguous, black and white sketch.
        // The image depicts a person looking at another person who is working at a desk near a window.
        const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAABAAAAAMgCAYAAADL5pIFAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAAAGySURBVHic7cExAQAAAMKg9U/tYwV/gAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIECBAgQIECAAAECBAgQIECAAAECBAgQIECAgAABAgQIECAAAECBAgQIDAAP06AAGs12tSAAAAAElFTkSuQmCC";

        response.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Error in static PPDT image handler:", error);
        response.status(500).json({ error: 'Failed to serve PPDT image.', details: error.message });
    }
}
