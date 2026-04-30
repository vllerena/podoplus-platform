import { useState } from "react";
import { UserPlus, X, Users, Crown, ChevronRight, Check } from "lucide-react";
import {
  Button,
  Input,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@podoplus/ui";
import {
  useCustomerFamily,
  useCustomers,
  useAuthenticatedImageUrl,
  type Customer,
} from "@/hooks/use-customers";
import { useAddFamilyMember, useRemoveFamilyMember } from "@/hooks/use-customer-actions";
import { useDebounce } from "@/hooks/use-debounce";

// ── Constants ─────────────────────────────────────────────────────────────────

const RELATION_OPTIONS = [
  "Papá",
  "Mamá",
  "Hijo(a)",
  "Hermano(a)",
  "Cónyuge",
  "Abuelo(a)",
  "Tío(a)",
  "Primo(a)",
  "Tutor(a)",
  "Otro",
];

// ── Sub-components ────────────────────────────────────────────────────────────

/** Wrapper needed because hooks can't be called inside .map() */
function MemberAvatar({
  avatarUrl,
  hasAvatar,
  initials,
  size = 10,
}: {
  avatarUrl: string | null;
  hasAvatar: boolean;
  initials: string;
  size?: number;
}) {
  const blobUrl = useAuthenticatedImageUrl(hasAvatar ? avatarUrl : null);
  const dim = `h-${size} w-${size}`;
  return blobUrl ? (
    <img
      src={blobUrl}
      alt={initials}
      className={`${dim} rounded-full object-cover shrink-0`}
    />
  ) : (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary ${size > 8 ? "text-sm" : "text-xs"}`}
    >
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  customerId: string;
}

export function FamilyTab({ customerId }: Props) {
  const [memberSearch, setMemberSearch]   = useState("");
  const [pendingMember, setPendingMember] = useState<Customer | null>(null);
  const [relation, setRelation]           = useState<string>("");

  const debouncedSearch = useDebounce(memberSearch, 300);

  const { data: family, isLoading }   = useCustomerFamily(customerId);
  const { data: searchResults }       = useCustomers({
    q: debouncedSearch || undefined,
    limit: 10,
  });

  const addMember    = useAddFamilyMember(customerId);
  const removeMember = useRemoveFamilyMember(customerId);

  const head    = family?.head    ?? null;
  const members = family?.members ?? [];

  // IDs already in the group (head + dependants + the current customer itself)
  const groupIds = new Set<string>([
    customerId,
    ...(head ? [head.id] : []),
    ...members.map((m) => m.id),
  ]);

  const filteredResults = (searchResults?.data ?? []).filter(
    (c) => !groupIds.has(c.id),
  );

  // ── Display logic ────────────────────────────────────────────────────
  // Don't show the current customer in their own family group list.
  // If they ARE the head: show only the dependants.
  // If they ARE a member: show the head (as Titular) + other members.
  const displayHead    = head?.id !== customerId ? head : null;
  const displayMembers = members.filter((m) => m.id !== customerId);
  const totalDisplayed = (displayHead ? 1 : 0) + displayMembers.length;

  function selectCandidate(c: Customer) {
    setPendingMember(c);
    setRelation("");
    setMemberSearch("");
  }

  function cancelPending() {
    setPendingMember(null);
    setRelation("");
  }

  function confirmAdd() {
    if (!pendingMember || !relation) return;
    addMember.mutate(
      { memberId: pendingMember.id, relation },
      { onSuccess: cancelPending },
    );
  }

  return (
    <div className="space-y-5">

      {/* ══ 1. ADD MEMBER (always first) ══════════════════════════════════ */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agregar miembro</h3>
        </div>

        <div className="p-4 space-y-3">

          {/* ── Step 1: search ─────────────────────────────────────────── */}
          {!pendingMember && (
            <>
              <Input
                placeholder="Buscar por nombre, teléfono…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />

              {debouncedSearch && (
                <div className="rounded-lg border bg-background max-h-52 overflow-y-auto">
                  {filteredResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se encontraron clientes disponibles
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {filteredResults.map((c) => {
                        const initials =
                          `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
                        return (
                          <li
                            key={c.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                            onClick={() => selectCandidate(c)}
                          >
                            <MemberAvatar
                              avatarUrl={c.avatarUrl}
                              hasAvatar={c.hasAvatar}
                              initials={initials}
                              size={8}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {c.firstName} {c.lastName}
                              </p>
                              {c.phone && (
                                <p className="text-xs text-muted-foreground">{c.phone}</p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 2: select relation & confirm ─────────────────────── */}
          {pendingMember && (
            <div className="space-y-3">
              {/* Selected member preview */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                <MemberAvatar
                  avatarUrl={pendingMember.avatarUrl}
                  hasAvatar={pendingMember.hasAvatar}
                  initials={`${pendingMember.firstName[0] ?? ""}${pendingMember.lastName[0] ?? ""}`.toUpperCase()}
                  size={9}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {pendingMember.firstName} {pendingMember.lastName}
                  </p>
                  {pendingMember.phone && (
                    <p className="text-xs text-muted-foreground">{pendingMember.phone}</p>
                  )}
                </div>
                <button
                  onClick={cancelPending}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Cancelar selección"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Relation selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tipo de parentesco *
                </label>
                <Select value={relation} onValueChange={setRelation}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar parentesco…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={confirmAdd}
                  disabled={!relation || addMember.isPending}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  {addMember.isPending ? "Agregando…" : "Confirmar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelPending}
                  disabled={addMember.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ 2. FAMILY GROUP LIST ══════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Grupo familiar</h3>
          {totalDisplayed > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({totalDisplayed} {totalDisplayed === 1 ? "miembro vinculado" : "miembros vinculados"})
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>

        ) : totalDisplayed === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Sin grupo familiar registrado</p>
            <p className="text-xs mt-1 opacity-60">
              Usa el buscador de arriba para agregar miembros
            </p>
          </div>

        ) : (
          <ul className="divide-y">
            {/* ── Titular / Family head (only if not the current customer) ── */}
            {displayHead && (
              <li className="flex items-center gap-3 px-4 py-3 bg-amber-50/60 dark:bg-amber-900/10">
                <MemberAvatar
                  avatarUrl={displayHead.avatarUrl}
                  hasAvatar={displayHead.hasAvatar}
                  initials={`${displayHead.firstName[0] ?? ""}${displayHead.lastName[0] ?? ""}`.toUpperCase()}
                  size={10}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {displayHead.firstName} {displayHead.lastName}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 shrink-0">
                      <Crown className="h-3 w-3" />
                      Titular
                    </span>
                  </div>
                  {displayHead.phone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{displayHead.phone}</p>
                  )}
                </div>
              </li>
            )}

            {/* ── Dependants (excluding the current customer) ───────────── */}
            {displayMembers.map((member) => {
              const initials =
                `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  <MemberAvatar
                    avatarUrl={member.avatarUrl}
                    hasAvatar={member.hasAvatar}
                    initials={initials}
                    size={10}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.firstName} {member.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {member.relation && (
                        <span className="inline-flex rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                          {member.relation}
                        </span>
                      )}
                      {member.phone && (
                        <span className="text-xs text-muted-foreground">{member.phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Remove button — visible on hover */}
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={() => removeMember.mutate(member.id)}
                    disabled={removeMember.isPending}
                    title="Quitar del grupo familiar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
