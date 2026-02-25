// lib/career/computeSubjectStatus.ts

export type Status =
    | "pendiente"
    | "cursando"
    | "final_pendiente"
    | "aprobada";

export type NodeStatus = Status | "disponible" | "bloqueada";

/**
 * ComputedStatus (NO cambiar reglas)
 *
 * Reglas:
 * - Si existe user_status y NO es "pendiente" => usarlo
 * - Si no:
 *   - sin correlativas => disponible
 *   - correlativas aprobadas => disponible
 *   - sino => bloqueada
 */
export function computeSubjectStatus(params: {
    userStatus?: Status | null;
    hasPrereqs: boolean;
    allPrereqsApproved: boolean;
}): NodeStatus {
    const { userStatus, hasPrereqs, allPrereqsApproved } = params;

    // 1) Si el usuario ya marcó un estado (distinto de pendiente), ese manda
    if (userStatus && userStatus !== "pendiente") {
        return userStatus;
    }

    // 2) Sin correlativas => disponible
    if (!hasPrereqs) {
        return "disponible";
    }

    // 3) Con correlativas y todas aprobadas => disponible
    if (allPrereqsApproved) {
        return "disponible";
    }

    // 4) Si no cumple => bloqueada
    return "bloqueada";
}