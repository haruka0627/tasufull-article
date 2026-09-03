/**
 * VRoid Hub usage conditions → TLV LIVE eligibility.
 * Official sources (developer.vroid.com/en/guidelines/conditions_of_use.html):
 *   VRM 0.0: CharacterModelSerializer.license.*
 *   VRM 1.0: CharacterModelSerializer.latest_character_model_version.vrm_meta.*
 * UNKNOWN / missing / uninterpreted values are never auto-allow.
 */

import { HUB_ERROR, MODEL_HUB_PAGE } from "./tlv-vroid-hub-spec.mjs";

export const ELIGIBILITY = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  INELIGIBLE: "INELIGIBLE",
  REQUIRES_CONFIRMATION: "REQUIRES_CONFIRMATION",
  UNKNOWN: "UNKNOWN",
});

function str(v) {
  return v == null ? "" : String(v);
}

function isOwnerContext(model, ctx) {
  if (ctx?.listKind === "account") return true;
  const hubUserId = str(ctx?.hubUserId);
  const ownerId = str(model?.character?.user?.id);
  return Boolean(hubUserId && ownerId && hubUserId === ownerId);
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return undefined;
}

function vrm1MetaRoot(version) {
  const meta = version?.vrm_meta;
  if (!meta || typeof meta !== "object") return null;
  if (meta.vrm10 && typeof meta.vrm10 === "object") return meta.vrm10;
  if (meta.vrm1 && typeof meta.vrm1 === "object") return meta.vrm1;
  return meta;
}

/**
 * @returns {"1.0"|"0.0"|"unknown"}
 */
export function detectHubVrmVersion(model) {
  const version = model?.latest_character_model_version;
  const spec = str(version?.spec_version).trim();
  const meta = vrm1MetaRoot(version);
  if (/^1(\.|$)/.test(spec)) return "1.0";
  if (meta) {
    const metaVer = pick(meta, ["metaVersion", "meta_version"]);
    if (str(metaVer) === "1" || str(metaVer).startsWith("1.")) return "1.0";
    if (
      pick(meta, ["avatarPermission", "avatar_permission"]) != null ||
      pick(meta, ["commercialUsage", "commercial_usage"]) != null ||
      pick(meta, ["creditNotation", "credit_notation"]) != null
    ) {
      return "1.0";
    }
  }
  if (/^0(\.|$)/.test(spec)) return "0.0";
  if (model?.license && typeof model.license === "object") return "0.0";
  if (version?.vendor_specified_license && typeof version.vendor_specified_license === "object") return "0.0";
  if (meta) return "1.0";
  return "unknown";
}

function mapAvatarVrm0(who) {
  if (who == null) return { value: null, ok: false };
  const v = str(who);
  if (v === "everyone") return { value: "everyone", ok: true };
  if (v === "author") return { value: "author", ok: true };
  if (v === "default") return { value: null, ok: false };
  return { value: null, ok: false, uninterpreted: v };
}

function mapAvatarVrm1(who) {
  if (who == null) return { value: null, ok: false };
  const v = str(who);
  if (v === "everyone") return { value: "everyone", ok: true };
  if (v === "onlyAuthor" || v === "only_author" || v === "author") return { value: "author", ok: true };
  if (v === "onlySeparatelyLicensedPerson" || v === "only_separately_licensed_person") {
    return { value: "separately_licensed", ok: true };
  }
  return { value: null, ok: false, uninterpreted: v };
}

function mapCreditVrm0(credit) {
  if (credit == null) return { value: null, ok: false };
  const v = str(credit);
  if (v === "unnecessary") return { value: "unnecessary", ok: true };
  if (v === "necessary" || v === "required") return { value: "necessary", ok: true };
  if (v === "default") return { value: "default", ok: true };
  return { value: null, ok: false, uninterpreted: v };
}

function mapCreditVrm1(credit) {
  if (credit == null) return { value: null, ok: false };
  const v = str(credit);
  if (v === "unnecessary") return { value: "unnecessary", ok: true };
  if (v === "required" || v === "necessary") return { value: "necessary", ok: true };
  return { value: null, ok: false, uninterpreted: v };
}

function mapCommercialVrm0(license) {
  const personal = license?.personal_commercial_use;
  const corporate = license?.corporate_commercial_use;
  if (personal == null || personal === "default" || corporate == null || corporate === "default") {
    return { value: null, ok: false };
  }
  const p = str(personal);
  const c = str(corporate);
  if (p === "disallow" && c === "disallow") return { value: "disallow", ok: true };
  if (p === "nonprofit") return { value: "personal_nonprofit", ok: true };
  if (c === "disallow" && p === "profit") return { value: "personal_profit", ok: true };
  if (c === "allow") return { value: "corporation", ok: true };
  if (p === "profit" && c === "allow") return { value: "corporation", ok: true };
  return { value: null, ok: false, uninterpreted: `${p}/${c}` };
}

function mapCommercialVrm1(raw) {
  if (raw == null) return { value: null, ok: false };
  const v = str(raw);
  if (v === "corporation") return { value: "corporation", ok: true };
  if (v === "personalProfit" || v === "personal_profit") return { value: "personal_profit", ok: true };
  if (v === "personalNonProfit" || v === "personal_non_profit" || v === "personal_nonprofit") {
    return { value: "personal_nonprofit", ok: true };
  }
  return { value: null, ok: false, uninterpreted: v };
}

function mapModificationVrm0(raw) {
  if (raw == null) return { value: null, ok: true, missing: true };
  const v = str(raw);
  if (v === "allow") return { value: "allow", ok: true };
  if (v === "disallow") return { value: "disallow", ok: true };
  if (v === "default") return { value: "default", ok: true };
  return { value: null, ok: false, uninterpreted: v };
}

function mapModificationVrm1(raw) {
  if (raw == null) return { value: null, ok: true, missing: true };
  const v = str(raw);
  if (v === "allowModificationRedistribution" || v === "allow_modification_redistribution") {
    return { value: "allow_with_redistribution", ok: true };
  }
  if (v === "allowModification" || v === "allow_modification" || v === "allow") {
    return { value: "allow", ok: true };
  }
  if (v === "prohibited" || v === "disallow") return { value: "disallow", ok: true };
  return { value: null, ok: false, uninterpreted: v };
}

function mapBool(raw) {
  if (raw == null) return { value: null, ok: true, missing: true };
  if (raw === true || raw === false) return { value: raw, ok: true };
  if (raw === "allow" || raw === "true") return { value: true, ok: true };
  if (raw === "disallow" || raw === "false") return { value: false, ok: true };
  return { value: null, ok: false, uninterpreted: str(raw) };
}

function mapRedistributionVrm0(raw) {
  if (raw == null || raw === "default") return { value: null, ok: true, missing: true };
  if (raw === "allow") return { value: true, ok: true };
  if (raw === "disallow") return { value: false, ok: true };
  return { value: null, ok: false, uninterpreted: str(raw) };
}

function mapExpressionVrm0(raw) {
  if (raw == null || raw === "default") return { value: null, ok: true, missing: true };
  if (raw === "allow") return { value: true, ok: true };
  if (raw === "disallow") return { value: false, ok: true };
  return { value: null, ok: false, uninterpreted: str(raw) };
}

function fromVrm0License(license, source) {
  return {
    ok: true,
    source,
    vrmVersion: "0.0",
    avatar: mapAvatarVrm0(license.characterization_allowed_user),
    commercial: mapCommercialVrm0(license),
    credit: mapCreditVrm0(license.credit),
    modification: mapModificationVrm0(license.modification),
    redistribution: mapRedistributionVrm0(license.redistribution),
    violent: mapExpressionVrm0(license.violent_expression),
    sexual: mapExpressionVrm0(license.sexual_expression),
    politicalReligious: { value: null, ok: true, missing: true },
    antisocialHate: { value: null, ok: true, missing: true },
    modifiedRedistribution: mapModificationVrm0(license.modification),
  };
}

function fromVrm1Meta(meta) {
  const modification = mapModificationVrm1(pick(meta, ["modification"]));
  return {
    ok: true,
    source: "vrm1_meta",
    vrmVersion: "1.0",
    avatar: mapAvatarVrm1(pick(meta, ["avatarPermission", "avatar_permission"])),
    commercial: mapCommercialVrm1(pick(meta, ["commercialUsage", "commercial_usage"])),
    credit: mapCreditVrm1(pick(meta, ["creditNotation", "credit_notation"])),
    modification,
    redistribution: mapBool(pick(meta, ["allowRedistribution", "allow_redistribution"])),
    violent: mapBool(pick(meta, ["allowExcessivelyViolentUsage", "allow_excessively_violent_usage"])),
    sexual: mapBool(pick(meta, ["allowExcessivelySexualUsage", "allow_excessively_sexual_usage"])),
    politicalReligious: mapBool(pick(meta, ["allowPoliticalOrReligiousUsage", "allow_political_or_religious_usage"])),
    antisocialHate: mapBool(pick(meta, ["allowAntisocialOrHateUsage", "allow_antisocial_or_hate_usage"])),
    modifiedRedistribution: {
      value: modification.value === "allow_with_redistribution",
      ok: modification.ok,
      missing: modification.missing,
      uninterpreted: modification.uninterpreted,
    },
  };
}

/**
 * Official usage-condition payload for Gate. Does not invent Hub UI values.
 * @returns {{ ok: boolean, source?: string, vrmVersion: string, avatar?: object, commercial?: object, credit?: object }}
 */
export function resolveOfficialUsageConditions(model) {
  const vrmVersion = detectHubVrmVersion(model);
  const version = model?.latest_character_model_version;
  if (vrmVersion === "1.0") {
    const meta = vrm1MetaRoot(version);
    if (!meta) {
      return { ok: false, vrmVersion, source: "vrm1_meta_missing" };
    }
    return fromVrm1Meta(meta);
  }
  if (model?.license && typeof model.license === "object") {
    return fromVrm0License(model.license, "vrm0_license");
  }
  const vendor = version?.vendor_specified_license;
  if (vendor && typeof vendor === "object") {
    return fromVrm0License(vendor, "vendor_specified");
  }
  return { ok: false, vrmVersion, source: null };
}

/** @deprecated use resolveOfficialUsageConditions — kept for hydrate stats / older callers */
export function resolveOfficialLicense(model) {
  const cond = resolveOfficialUsageConditions(model);
  if (!cond.ok) return null;
  return {
    characterization_allowed_user: cond.avatar?.value === "everyone" ? "everyone" : cond.avatar?.value === "author" ? "author" : null,
    personal_commercial_use:
      cond.commercial?.value === "corporation" || cond.commercial?.value === "personal_profit"
        ? "profit"
        : cond.commercial?.value === "personal_nonprofit"
          ? "nonprofit"
          : cond.commercial?.value === "disallow"
            ? "disallow"
            : null,
    corporate_commercial_use: cond.commercial?.value === "corporation" ? "allow" : cond.commercial?.ok ? "disallow" : null,
    credit: cond.credit?.value === "necessary" ? "necessary" : cond.credit?.value === "unnecessary" ? "unnecessary" : cond.credit?.value || null,
    modification:
      cond.modification?.value === "allow" || cond.modification?.value === "allow_with_redistribution"
        ? "allow"
        : cond.modification?.value === "disallow"
          ? "disallow"
          : null,
    redistribution: cond.redistribution?.value === true ? "allow" : cond.redistribution?.value === false ? "disallow" : null,
    sexual_expression: cond.sexual?.value === true ? "allow" : cond.sexual?.value === false ? "disallow" : null,
    violent_expression: cond.violent?.value === true ? "allow" : cond.violent?.value === false ? "disallow" : null,
    _source: cond.source,
    _vrmVersion: cond.vrmVersion,
  };
}

function publicConditionCard(cond) {
  if (!cond?.ok) {
    return {
      vrmVersion: cond?.vrmVersion || "unknown",
      source: cond?.source || null,
      avatar: null,
      commercial: null,
      credit: null,
      modification: null,
      redistribution: null,
      modifiedRedistribution: null,
    };
  }
  return {
    vrmVersion: cond.vrmVersion,
    source: cond.source,
    avatar: cond.avatar?.value ?? null,
    commercial: cond.commercial?.value ?? null,
    credit: cond.credit?.value ?? null,
    modification: cond.modification?.value ?? null,
    redistribution: cond.redistribution?.value ?? null,
    modifiedRedistribution: cond.modifiedRedistribution?.value ?? null,
    violent: cond.violent?.value ?? null,
    sexual: cond.sexual?.value ?? null,
    politicalReligious: cond.politicalReligious?.value ?? null,
    antisocialHate: cond.antisocialHate?.value ?? null,
  };
}

/**
 * Safe card for UI / persistence. No download URLs. No tokens.
 */
export function adaptHubModelCard(model, eligibility) {
  const cond = resolveOfficialUsageConditions(model);
  const pub = publicConditionCard(cond);
  const thumb =
    model?.portrait_image?.sq150?.url ||
    model?.portrait_image?.w300?.url ||
    model?.full_body_image?.w300?.url ||
    "";
  return {
    id: str(model?.id),
    name: str(model?.name || model?.character?.name || "untitled"),
    creator: str(model?.character?.user?.name || ""),
    creatorId: str(model?.character?.user?.id),
    thumbnail: thumb,
    isDownloadable: model?.is_downloadable !== false,
    isPrivate: Boolean(model?.is_private),
    isOtherUsersAvailable: Boolean(model?.is_other_users_available),
    vrmVersion: pub.vrmVersion,
    licenseSource: pub.source,
    license: {
      characterization: pub.avatar,
      personalCommercial:
        pub.commercial === "corporation" || pub.commercial === "personal_profit"
          ? "profit"
          : pub.commercial === "personal_nonprofit"
            ? "nonprofit"
            : pub.commercial === "disallow"
              ? "disallow"
              : null,
      corporateCommercial: pub.commercial === "corporation" ? "allow" : pub.commercial ? "disallow" : null,
      commercialUsage: pub.commercial,
      credit: pub.credit,
      modification: pub.modification,
      redistribution: pub.redistribution === true ? "allow" : pub.redistribution === false ? "disallow" : null,
      modifiedRedistribution: pub.modifiedRedistribution,
      sexualExpression: pub.sexual === true ? "allow" : pub.sexual === false ? "disallow" : null,
      violentExpression: pub.violent === true ? "allow" : pub.violent === false ? "disallow" : null,
    },
    eligibility: eligibility?.result || ELIGIBILITY.UNKNOWN,
    eligibilityCode: eligibility?.code || HUB_ERROR.LICENSE_UNKNOWN,
    reason: eligibility?.reason || "",
    selectable: Boolean(eligibility?.selectable),
    needsConfirmation: Boolean(eligibility?.needsConfirmation),
    hubPage: model?.id ? MODEL_HUB_PAGE(model.id) : "",
    source: "vroid_hub",
  };
}

function unknown(reason) {
  return {
    result: ELIGIBILITY.UNKNOWN,
    code: HUB_ERROR.LICENSE_UNKNOWN,
    reason,
    selectable: false,
    needsConfirmation: false,
  };
}

function ineligible(reason) {
  return {
    result: ELIGIBILITY.INELIGIBLE,
    code: HUB_ERROR.LICENSE_INELIGIBLE,
    reason,
    selectable: false,
    needsConfirmation: false,
  };
}

function confirm(reason) {
  return {
    result: ELIGIBILITY.REQUIRES_CONFIRMATION,
    code: HUB_ERROR.CONFIRMATION_REQUIRED,
    reason,
    selectable: true,
    needsConfirmation: true,
  };
}

/**
 * @param {object | null} model
 * @param {{ listKind?: "account"|"hearts", hubUserId?: string }} [ctx]
 */
export function evaluateTlvStreamingEligibility(model, ctx = {}) {
  if (!model || typeof model !== "object" || !str(model.id)) {
    return unknown("モデル情報がありません");
  }

  if (model.is_downloadable === false) {
    return {
      result: ELIGIBILITY.INELIGIBLE,
      code: HUB_ERROR.MODEL_UNAVAILABLE,
      reason: "このモデルはダウンロードできません",
      selectable: false,
      needsConfirmation: false,
    };
  }

  const version = model.latest_character_model_version;
  const owner = isOwnerContext(model, ctx);
  if (!owner && version?.is_vendor_forbidden_use_by_others === true) {
    return ineligible("ベンダー指定により第三者利用が禁止されています");
  }

  const cond = resolveOfficialUsageConditions(model);
  if (!cond.ok) {
    if (cond.vrmVersion === "1.0") {
      return unknown("VRM 1.0 の vrm_meta が無いため自動許可しません");
    }
    return unknown("利用条件メタデータが無いため自動許可しません");
  }

  if (!owner) {
    if (model.is_other_users_available === false) {
      return ineligible("第三者利用が許可されていません");
    }
    if (!cond.avatar?.ok) {
      return unknown("アバター利用条件が default / 未提供 / 未解釈のため自動許可しません");
    }
    if (cond.avatar.value === "author") {
      return ineligible("アバター利用は作者のみ許可されています");
    }
    if (cond.avatar.value === "separately_licensed") {
      return unknown("別途ライセンス対象者のみのため自動許可しません");
    }
    if (cond.avatar.value !== "everyone") {
      return unknown("未知のアバター利用条件のため自動許可しません");
    }

    if (!cond.commercial?.ok) {
      return unknown("商用利用条件が未提供 / 未解釈のため自動許可しません");
    }
    if (cond.commercial.value === "disallow") {
      return ineligible("商用利用が不許可のため TLV LIVE では使えません");
    }
    if (cond.commercial.value === "personal_nonprofit") {
      return confirm(
        "個人の非営利利用のみ許可されています。TASFUL は作者条件を上書きしません。有料チップ等がある配信には使わないでください。",
      );
    }
    if (cond.commercial.value === "personal_profit") {
      return confirm("法人商用は不許可です。個人としての配信であること、および作者の利用条件を確認してください。");
    }
    if (cond.commercial.value !== "corporation") {
      return unknown("未知の商用利用条件のため自動許可しません");
    }
  }

  if (!cond.credit?.ok) {
    return unknown("クレジット要否が未提供 / 未解釈のため自動許可しません");
  }
  if (cond.credit.value === "default") {
    return confirm("クレジット要否が default のため、表示条件を確認してください");
  }
  if (cond.credit.value === "necessary") {
    return confirm("クレジット表記が必要です。配信画面で作者名を表示できることを確認してください。");
  }

  if (cond.modification && cond.modification.ok === false) {
    return unknown("改変条件が未解釈のため自動許可しません");
  }
  if (cond.redistribution && cond.redistribution.ok === false) {
    return unknown("再配布条件が未解釈のため自動許可しません");
  }

  return {
    result: ELIGIBILITY.ELIGIBLE,
    code: "OK",
    reason: owner ? "自分のモデル（ダウンロード可能）" : "利用条件を満たしています",
    selectable: true,
    needsConfirmation: false,
  };
}

export function canAcquire(eligibility, { confirmed } = {}) {
  if (!eligibility) {
    return { ok: false, code: HUB_ERROR.LICENSE_UNKNOWN };
  }
  if (eligibility.result === ELIGIBILITY.INELIGIBLE) {
    return { ok: false, code: eligibility.code || HUB_ERROR.LICENSE_INELIGIBLE };
  }
  if (eligibility.result === ELIGIBILITY.UNKNOWN) {
    return { ok: false, code: HUB_ERROR.LICENSE_UNKNOWN };
  }
  if (eligibility.result === ELIGIBILITY.REQUIRES_CONFIRMATION && !confirmed) {
    return { ok: false, code: HUB_ERROR.CONFIRMATION_REQUIRED };
  }
  if (eligibility.result === ELIGIBILITY.ELIGIBLE || eligibility.result === ELIGIBILITY.REQUIRES_CONFIRMATION) {
    return { ok: true };
  }
  return { ok: false, code: HUB_ERROR.LICENSE_UNKNOWN };
}

export function usageSchemaShape(model) {
  const version = model?.latest_character_model_version;
  const meta = version?.vrm_meta && typeof version.vrm_meta === "object" ? version.vrm_meta : null;
  const nested = meta && (meta.vrm10 || meta.vrm1) && typeof (meta.vrm10 || meta.vrm1) === "object" ? meta.vrm10 || meta.vrm1 : null;
  const keys = (obj) =>
    obj && typeof obj === "object"
      ? Object.keys(obj).filter((k) => !/token|secret|authorization|email|password|cookie/i.test(k)).slice(0, 32)
      : [];
  return {
    vrmVersion: detectHubVrmVersion(model),
    hasLicenseKey: Boolean(model?.license && typeof model.license === "object"),
    hasVendorLicense: Boolean(version?.vendor_specified_license),
    hasVersion: Boolean(version),
    specVersionPresent: Boolean(str(version?.spec_version)),
    specLooksLike: /^1(\.|$)/.test(str(version?.spec_version)) ? "1.x" : /^0(\.|$)/.test(str(version?.spec_version)) ? "0.x" : str(version?.spec_version) ? "other" : "missing",
    hasVrmMeta: Boolean(meta),
    vrmMetaKeys: keys(meta),
    nestedVrm10: Boolean(nested),
    nestedVrm10Keys: keys(nested),
    versionKeys: keys(version),
  };
}
