/**
 * Create a JSON-safe copy of engine state.
 *
 * Engine state intentionally contains only serializable data. Returning a
 * detached snapshot protects controller/AI consumers from accidentally
 * mutating the authoritative state while keeping save/network integration
 * straightforward.
 */
export function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}
