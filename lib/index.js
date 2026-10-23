/**
 * dsh-skill-panel — Host half.
 *
 * The feature lives entirely in the Client half (lib/client.js): it reads the
 * session skill catalog over the official `skills/list` Remote and renders a
 * sidebar button plus its panel. This Host half only owns the Loader row, which
 * is what makes the Web composition serve the client bundle at all.
 *
 * @module dsh-skill-panel
 */

export const name = 'skill-panel'

export const inject = []

/**
 * No Host behaviour to mount; the Loader row exists so the Client half loads.
 */
export function apply() {}
