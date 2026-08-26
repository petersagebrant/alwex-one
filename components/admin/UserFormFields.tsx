"use client";

import { useState } from "react";
import {
  APP_ROLE_LABELS,
  APP_ROLES,
  isAppRole,
  roleRequiresBusinessArea,
  type AppRole,
} from "@/lib/auth/roles";

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

export function UserFormFields({
  areas,
  user,
  lockRole,
  lockArea,
}: {
  areas: { id: string; name: string }[];
  user?: {
    role: AppRole;
    rawDisplayName: string;
    businessAreaId: string | null;
  } | null;
  lockRole?: boolean;
  lockArea?: boolean;
}) {
  const [role, setRole] = useState(user?.role ?? "");
  const [businessAreaId, setBusinessAreaId] = useState(
    user?.businessAreaId ?? "",
  );
  const areaRequired = isAppRole(role) && roleRequiresBusinessArea(role);

  function handleRoleChange(nextRole: string) {
    setRole(nextRole);
    if (lockArea) {
      return;
    }
    if (isAppRole(nextRole) && !roleRequiresBusinessArea(nextRole)) {
      setBusinessAreaId("");
    }
  }

  return (
    <>
      <div>
        <label
          htmlFor="displayName"
          className="block text-xs font-medium text-neutral-500"
        >
          Namn
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={120}
          defaultValue={user?.rawDisplayName ?? ""}
          className={fieldClassName}
        />
      </div>

      {user ? null : (
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-neutral-500"
          >
            E-post
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            className={fieldClassName}
          />
        </div>
      )}

      <div>
        <label
          htmlFor="role"
          className="block text-xs font-medium text-neutral-500"
        >
          Roll
        </label>
        <select
          id="role"
          name="role"
          required
          value={role}
          disabled={lockRole}
          onChange={(event) => handleRoleChange(event.target.value)}
          className={fieldClassName}
        >
          <option value="" disabled>
            Välj roll
          </option>
          {APP_ROLES.map((appRole) => (
            <option key={appRole} value={appRole}>
              {APP_ROLE_LABELS[appRole]}
            </option>
          ))}
        </select>
        {lockRole ? (
          <input type="hidden" name="role" value={user?.role ?? ""} />
        ) : null}
      </div>

      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        <select
          id="businessAreaId"
          name={areaRequired && !lockArea ? "businessAreaId" : undefined}
          value={businessAreaId}
          required={areaRequired}
          disabled={lockArea || !areaRequired}
          autoComplete="off"
          onChange={(event) => setBusinessAreaId(event.target.value)}
          className={fieldClassName}
        >
          <option value="">Inget (alla roller utom AO-chef)</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        {lockArea ? (
          <input
            type="hidden"
            name="businessAreaId"
            value={user?.businessAreaId ?? ""}
          />
        ) : null}
        {!lockArea && !areaRequired ? (
          <input type="hidden" name="businessAreaId" value="" />
        ) : null}
        <p className="mt-1.5 text-xs text-neutral-500">
          Obligatoriskt för AO-chef. Vice VD, VD och övriga roller ska ha Inget.
        </p>
      </div>
    </>
  );
}
