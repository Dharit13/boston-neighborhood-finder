import type { Libraries } from "@react-google-maps/api";

// Shared libraries array — must be a stable reference and identical across
// every useJsApiLoader call site, otherwise @react-google-maps/api warns
// "Performance warning! LoadScript has been reloaded unintentionally".
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];
