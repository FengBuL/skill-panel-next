/* Phase F Compare API fragment — paste into shared.js (inside the main IIFE, near other Phase APIs).
 *
 * PASTE NOTES:
 * 1. Paste function bodies below into shared.js (they rely on existing helpers in that closure).
 * 2. Replace existing openCompare with openCompare below.
 * 3. Export on SP:
 *    openCompareSession, getCompareOverview, getCompareFileSummary, getCompareFileDetail,
 *    resolveDuplicateComparison, getCompareSession
 *    (openCompare already exported — replace implementation)
 * 4. ensureEditorCollections already initializes state.compareSessions = [].
 *
 * Rules:
 * - File bodies only via getCompareFileDetail / getFileDetail
 * - No read permission → metadata only
 * - Merge to multi-instance preserves primary Asset UUID
 * - Ignore duplicate resolves Duplicate PendingTask ONLY — never creates skill_id IgnoreRule
 */

/* ---------- Phase F Compare APIs ---------- */

function ensureCompareCollections() {
  ensureEditorCollections();
  const state = getState();
  if (!state.compareSessions) state.compareSessions = [];
  return state;
}

function toSafeCompareSessionView(session) {
  if (!session) return null;
  return JSON.parse(JSON.stringify({
    id: session.id,
    candidateIds: $coerceArray(session.candidateIds),
    groupId: session.groupId || null,
    status: session.status || 'open',
    createdAt: session.createdAt,
    resolvedAt: session.resolvedAt || null,
    resolution: session.resolution || null,
    primaryAssetId: session.primaryAssetId || null,
    evidence: session.evidence || null
  }));
}

function resolveCompareCandidateIds(candidateIdsOrSessionId) {
  if (candidateIdsOrSessionId == null) return [];
  if (Array.isArray(candidateIdsOrSessionId)) {
    return candidateIdsOrSessionId.map(id => resolveAssetId(id) || id).filter(Boolean);
  }
  const sid = String(candidateIdsOrSessionId);
  const session = ensureCompareCollections().compareSessions.find(s => s.id === sid);
  if (session) return $coerceArray(session.candidateIds).slice();
  const group = resolveDuplicateGroup(sid);
  if (group) return $coerceArray(group.skillIds).map(id => resolveAssetId(id) || id).filter(Boolean);
  const rid = resolveAssetId(sid);
  return rid ? [rid] : [];
}

function buildCompareCandidateOverview(assetId) {
  const rid = resolveAssetId(assetId) || assetId;
  const asset = getAssetRaw(rid);
  if (!asset) return null;
  const state = getState();
  const instances = state.instances.filter(i => i.skillId === rid);
  const primary = instances.find(i => i.isPrimary) || instances[0] || null;
  const files = primary ? getFilesRawInternal({ instanceId: primary.id }) : [];
  const skillMd = files.find(f => String(f.relativePath || '').toLowerCase() === 'skill.md') || null;
  const binding = asset.sourceBindingId
    ? state.sourceBindings.find(b => b.id === asset.sourceBindingId)
    : (primary && primary.sourceBindingId ? state.sourceBindings.find(b => b.id === primary.sourceBindingId) : null);
  const perm = primary ? getInstancePermission(primary.id) : null;
  const usage = getAssetUsageSummary(rid);
  const packageHash = primary ? packageHashForInstance(primary.id) : null;
  const fileTree = files.map(f => ({
    id: f.id,
    relativePath: f.relativePath,
    fileType: f.fileType,
    sizeBytes: f.sizeBytes,
    contentHash: f.contentHash,
    indexStatus: f.indexStatus
  })).sort((a, b) => String(a.relativePath).localeCompare(String(b.relativePath)));

  return {
    candidateId: rid,
    assetId: rid,
    name: asset.name,
    displayName: asset.displayName || asset.name,
    description: asset.description || '',
    lifecycleStatus: asset.lifecycleStatus,
    version: primary ? (primary.installedVersion || '') : '',
    source: binding
      ? {
          bound: true,
          sourceType: binding.sourceType,
          repository: binding.repository || null,
          updateStatus: binding.updateStatus || null,
          trustPolicy: binding.trustPolicy || null
        }
      : { bound: false, sourceType: null, repository: null, updateStatus: 'unbound', trustPolicy: null },
    repository: binding ? (binding.repository || null) : null,
    instance: primary
      ? {
          id: primary.id,
          hostType: primary.hostType,
          hostLabel: _hostLabel(primary.hostType),
          rootPath: primary.rootPath,
          skillFilePath: primary.skillFilePath,
          lifecycleStatus: primary.lifecycleStatus,
          isPrimary: !!primary.isPrimary,
          permissionMode: primary.permissionMode
        }
      : null,
    instances: instances.map(i => ({
      id: i.id,
      hostType: i.hostType,
      hostLabel: _hostLabel(i.hostType),
      rootPath: i.rootPath,
      skillFilePath: i.skillFilePath,
      lifecycleStatus: i.lifecycleStatus,
      isPrimary: !!i.isPrimary
    })),
    host: primary ? primary.hostType : null,
    hostLabel: primary ? _hostLabel(primary.hostType) : '—',
    fileStructure: fileTree,
    fileCount: files.length,
    packageHash,
    skillMdHash: skillMd ? skillMd.contentHash : null,
    skillMdFileId: skillMd ? skillMd.id : null,
    packageSizeBytes: files.reduce((n, f) => n + (f.sizeBytes || 0), 0),
    permission: perm
      ? {
          readAccess: !!perm.readAccess,
          writeAccess: !!perm.writeAccess,
          contentAccessStatus: perm.contentAccessStatus,
          isMissing: !!perm.isMissing
        }
      : { readAccess: false, writeAccess: false, contentAccessStatus: 'denied', isMissing: true },
    usageCredibility: usage
      ? {
          supported: !!usage.supported,
          dataStatus: usage.dataStatus,
          attributionLevel: usage.attributionLevel,
          displayLabel: usage.displayLabel,
          displayCalls: usage.displayCalls,
          hasUsageData: !!usage.supported && usage.dataStatus !== 'unsupported'
        }
      : { supported: false, dataStatus: 'unsupported', attributionLevel: 'no-data', displayLabel: '暂无数据', displayCalls: null, hasUsageData: false }
  };
}

function openCompareSession(candidateIds, options = {}) {
  ensureCompareCollections();
  const ids = $coerceArray(candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
  const unique = [];
  ids.forEach(id => { if (!unique.includes(id)) unique.push(id); });
  if (unique.length < 2) {
    return { ok: false, error: 'Need at least 2 candidates', session: null };
  }
  let groupId = options.groupId || null;
  if (!groupId) {
    const group = getState().duplicateGroups.find(g =>
      unique.every(id => $safeIncludes(g.skillIds, id)) ||
      unique.some(id => $safeIncludes(g.skillIds, id))
    );
    if (group) groupId = group.id;
  }
  const evidence = groupId
    ? (resolveDuplicateGroup(groupId)?.evidence || DUP_CONTENT[resolveDuplicateGroup(groupId)?.name] || null)
    : (options.evidence || null);
  const session = {
    id: options.id || uuid(),
    candidateIds: unique,
    groupId,
    status: 'open',
    createdAt: $now(),
    resolvedAt: null,
    resolution: null,
    primaryAssetId: options.primaryAssetId || unique[0],
    evidence: evidence ? JSON.parse(JSON.stringify(evidence)) : null
  };
  getState().compareSessions.push(session);
  saveState();
  return { ok: true, session: toSafeCompareSessionView(session) };
}

function getCompareSession(sessionId) {
  if (!sessionId) return null;
  ensureCompareCollections();
  const session = getState().compareSessions.find(s => s.id === sessionId);
  return toSafeCompareSessionView(session);
}

function getCompareOverview(candidateIdsOrSessionId) {
  ensureCompareCollections();
  let session = null;
  let candidateIds = [];
  if (typeof candidateIdsOrSessionId === 'string') {
    session = getState().compareSessions.find(s => s.id === candidateIdsOrSessionId);
    if (session) candidateIds = $coerceArray(session.candidateIds).slice();
    else candidateIds = resolveCompareCandidateIds(candidateIdsOrSessionId);
  } else {
    candidateIds = resolveCompareCandidateIds(candidateIdsOrSessionId);
  }
  const candidates = candidateIds.map(buildCompareCandidateOverview).filter(Boolean);
  const hashes = candidates.map(c => c.skillMdHash).filter(Boolean);
  const packageHashes = candidates.map(c => c.packageHash).filter(Boolean);
  const allSkillMdReadable = candidates.every(c => c.permission && c.permission.readAccess && c.permission.contentAccessStatus === 'readable' && c.skillMdFileId);
  return JSON.parse(JSON.stringify({
    sessionId: session ? session.id : null,
    session: session ? toSafeCompareSessionView(session) : null,
    groupId: session ? session.groupId : null,
    evidence: session ? session.evidence : null,
    candidateCount: candidates.length,
    candidates,
    comparison: {
      skillMdHashMatch: hashes.length >= 2 && hashes.every(h => h === hashes[0]),
      packageHashMatch: packageHashes.length >= 2 && packageHashes.every(h => h === packageHashes[0]),
      nameOverlap: (() => {
        const names = candidates.map(c => String(c.name || '').toLowerCase());
        return names.length >= 2 && names.some((n, i) => names.some((m, j) => i !== j && (n.includes(m) || m.includes(n))));
      })(),
      allSkillMdReadable,
      structureOverlap: (() => {
        if (candidates.length < 2) return 0;
        const sets = candidates.map(c => new Set((c.fileStructure || []).map(f => f.relativePath)));
        const base = sets[0];
        let shared = 0;
        base.forEach(p => { if (sets.every(s => s.has(p))) shared++; });
        const union = new Set();
        sets.forEach(s => s.forEach(p => union.add(p)));
        return union.size ? Math.round((shared / union.size) * 100) : 0;
      })()
    }
  }));
}

function getCompareFileSummary(sessionId) {
  ensureCompareCollections();
  const session = getState().compareSessions.find(s => s.id === sessionId);
  if (!session) return null;
  const overview = getCompareOverview(sessionId);
  const pathMap = {};
  (overview.candidates || []).forEach(c => {
    (c.fileStructure || []).forEach(f => {
      const key = f.relativePath;
      if (!pathMap[key]) pathMap[key] = { relativePath: key, fileType: f.fileType, byCandidate: {} };
      pathMap[key].byCandidate[c.candidateId] = {
        fileId: f.id,
        contentHash: f.contentHash,
        sizeBytes: f.sizeBytes,
        indexStatus: f.indexStatus,
        readAccess: !!(c.permission && c.permission.readAccess)
      };
    });
  });
  const files = Object.values(pathMap).map(row => {
    const hashes = Object.values(row.byCandidate).map(x => x.contentHash).filter(Boolean);
    const presentIn = Object.keys(row.byCandidate);
    return {
      relativePath: row.relativePath,
      fileType: row.fileType,
      presentIn,
      missingIn: (overview.candidates || []).map(c => c.candidateId).filter(id => !row.byCandidate[id]),
      hashMatch: hashes.length >= 2 && hashes.every(h => h === hashes[0]),
      byCandidate: row.byCandidate
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return JSON.parse(JSON.stringify({
    sessionId,
    candidateIds: $coerceArray(session.candidateIds),
    files,
    skillMd: files.find(f => String(f.relativePath).toLowerCase() === 'skill.md') || null
  }));
}

function getCompareFileDetail(compareSessionId, candidateId, fileId) {
  ensureCompareCollections();
  const session = getState().compareSessions.find(s => s.id === compareSessionId);
  if (!session) return { ok: false, error: 'Compare session not found', content: null };
  const rid = resolveAssetId(candidateId) || candidateId;
  if (!$safeIncludes(session.candidateIds, rid)) {
    return { ok: false, error: 'Candidate not in session', content: null };
  }
  const detail = getFileDetail(fileId);
  if (!detail) return { ok: false, error: 'File not found', content: null };
  if (detail.skillId && detail.skillId !== rid && detail.instance && detail.instance.skillId !== rid) {
    // allow if file belongs to an instance of this candidate
    const inst = getInstanceRaw(detail.instanceId || (detail.instance && detail.instance.id));
    if (!inst || inst.skillId !== rid) {
      return { ok: false, error: 'File does not belong to candidate', content: null };
    }
  }
  // Controlled read: mirror getFileDetail — body only when readable
  const canRead = !!detail.readAccess && detail.contentAccessStatus === 'readable' && !detail.isBinary;
  return JSON.parse(JSON.stringify({
    ok: true,
    sessionId: compareSessionId,
    candidateId: rid,
    fileId: detail.id,
    relativePath: detail.relativePath,
    fileType: detail.fileType,
    sizeBytes: detail.sizeBytes,
    contentHash: detail.contentHash,
    indexStatus: detail.indexStatus,
    isBinary: !!detail.isBinary,
    readAccess: !!detail.readAccess,
    contentAccessStatus: detail.contentAccessStatus,
    content: canRead ? String(detail.content || '') : null,
    contentForView: canRead ? String(detail.contentForView || detail.content || '') : null,
    instance: detail.instance || null,
    hostLabel: detail.hostLabel || null
  }));
}

function resolveDuplicateTasksForCandidates(candidateIds, groupId) {
  const state = getState();
  const ids = new Set(candidateIds);
  let count = 0;
  state.pendingTasks.forEach(t => {
    if (t.status !== 'open' || t.taskType !== 'duplicate_candidate') return;
    const matchGroup = groupId && t.groupId === groupId;
    const matchSkill = ids.has(t.skillId);
    if (matchGroup || matchSkill) {
      t.status = 'resolved';
      t.resolvedAt = $now();
      count++;
    }
  });
  if (groupId) {
    const g = state.duplicateGroups.find(x => x.id === groupId);
    if (g) g.status = 'resolved';
  }
  return count;
}

function mergeCandidatesAsMultiInstance(primaryAssetId, otherIds) {
  const primary = getAssetRaw(primaryAssetId);
  if (!primary) return { ok: false, error: 'Primary asset not found' };
  const preservedUuid = primary.id;
  const movedInstanceIds = [];
  const deletedAssetIds = [];
  otherIds.forEach(oid => {
    if (oid === primaryAssetId) return;
    const other = getAssetRaw(oid);
    if (!other) return;
    getState().instances.filter(i => i.skillId === oid).forEach(inst => {
      inst.skillId = primaryAssetId;
      inst.isPrimary = false;
      movedInstanceIds.push(inst.id);
    });
    getState().files.filter(f => f.skillId === oid).forEach(f => { f.skillId = primaryAssetId; });
    getState().sourceBindings.filter(b => b.skillId === oid).forEach(b => { b.skillId = primaryAssetId; });
    getState().pendingTasks.filter(t => t.skillId === oid).forEach(t => { t.skillId = primaryAssetId; });
    getState().drafts.filter(d => d.skillId === oid).forEach(d => { d.skillId = primaryAssetId; });
    getState().snapshots.filter(s => s.skillId === oid).forEach(s => { s.skillId = primaryAssetId; });
    other.lifecycleStatus = 'deleted';
    other.primaryInstanceId = null;
    other.updatedAt = $now();
    deletedAssetIds.push(other.id);
  });
  const instances = getState().instances.filter(i => i.skillId === primaryAssetId);
  if (!instances.some(i => i.isPrimary) && instances.length) {
    const next = instances.find(i => i.lifecycleStatus === 'available') || instances[0];
    instances.forEach(i => { i.isPrimary = i.id === next.id; });
    primary.primaryInstanceId = next.id;
  }
  primary.updatedAt = $now();
  return {
    ok: true,
    preservedAssetId: preservedUuid,
    movedInstanceIds,
    deletedAssetIds,
    instanceCount: instances.length
  };
}

function createMergedAssetFromCandidates(candidateIds, options = {}) {
  const ids = candidateIds.slice();
  if (ids.length < 2) return { ok: false, error: 'Need at least 2 candidates' };
  const sources = ids.map(id => getAssetRaw(id)).filter(Boolean);
  if (!sources.length) return { ok: false, error: 'No assets found' };
  const name = options.name || (sources[0].name + '-merged');
  const newId = uuid();
  const primarySrc = sources[0];
  const firstInst = getState().instances.find(i => i.skillId === primarySrc.id && i.isPrimary)
    || getState().instances.find(i => i.skillId === primarySrc.id);
  getState().assets.push(normalizeAsset({
    id: newId,
    name,
    displayName: options.displayName || (primarySrc.displayName + ' (合并)'),
    description: primarySrc.description || '',
    categoryIds: (primarySrc.categoryIds || []).slice(),
    tagIds: (primarySrc.tagIds || []).slice(),
    lifecycleStatus: 'available',
    isFavorite: false,
    primaryInstanceId: null,
    createdAt: $now(),
    updatedAt: $now()
  }));
  const moved = [];
  ids.forEach(oid => {
    getState().instances.filter(i => i.skillId === oid).forEach(inst => {
      inst.skillId = newId;
      inst.isPrimary = false;
      moved.push(inst.id);
    });
    getState().files.filter(f => f.skillId === oid).forEach(f => { f.skillId = newId; });
    const other = getAssetRaw(oid);
    if (other) {
      other.lifecycleStatus = 'deleted';
      other.primaryInstanceId = null;
      other.updatedAt = $now();
    }
  });
  const instances = getState().instances.filter(i => i.skillId === newId);
  if (instances.length) {
    const prefer = firstInst && instances.find(i => i.id === firstInst.id) || instances[0];
    instances.forEach(i => { i.isPrimary = i.id === prefer.id; });
    getAssetRaw(newId).primaryInstanceId = prefer.id;
  }
  return { ok: true, newAssetId: newId, movedInstanceIds: moved, name };
}

/**
 * options:
 *  - sessionId
 *  - action: 'confirm-multi-instance' | 'keep-independent' | 'archive' | 'ignore' | 'merge-new'
 *  - primaryAssetId (for confirm-multi-instance)
 *  - archiveAssetId / archiveInstanceId
 *  - groupId
 *  - name / displayName (for merge-new)
 */
function resolveDuplicateComparison(options = {}) {
  ensureCompareCollections();
  const action = options.action || options.resolution;
  if (!action) return { ok: false, error: 'Missing action' };

  const session = options.sessionId
    ? getState().compareSessions.find(s => s.id === options.sessionId)
    : null;
  const candidateIds = session
    ? $coerceArray(session.candidateIds).slice()
    : $coerceArray(options.candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
  const groupId = options.groupId || (session && session.groupId) || null;

  let result = { ok: true, action, ignoreRuleCreated: false };
  const beforeIgnoreCount = (getState().ignoreRules || []).length;

  if (action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance') {
    const primaryAssetId = resolveAssetId(options.primaryAssetId) || options.primaryAssetId || candidateIds[0];
    const others = candidateIds.filter(id => id !== primaryAssetId);
    const merge = mergeCandidatesAsMultiInstance(primaryAssetId, others);
    if (!merge.ok) return merge;
    const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
    addAuditEvent({
      skillId: primaryAssetId,
      eventType: 'compare_confirm_multi_instance',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      note: '确认为同一 Asset 多实例 · 保留 UUID ' + primaryAssetId + ' · 并入实例 ' + merge.movedInstanceIds.length
    });
    result = {
      ...result,
      ...merge,
      preservedAssetId: merge.preservedAssetId,
      resolvedTaskCount: resolved
    };
  } else if (action === 'keep-independent' || action === 'keep_independent' || action === 'keep-both') {
    const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
    addAuditEvent({
      eventType: 'compare_keep_independent',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      note: '保持独立 Asset · UUID 未变 · 候选 ' + candidateIds.join(',')
    });
    result = { ...result, candidateIds: candidateIds.slice(), resolvedTaskCount: resolved, uuidsUnchanged: true };
  } else if (action === 'archive') {
    const archiveAssetId = resolveAssetId(options.archiveAssetId) || options.archiveAssetId;
    const archiveInstanceId = options.archiveInstanceId || null;
    if (archiveInstanceId) {
      const inst = getInstanceRaw(archiveInstanceId);
      if (!inst) return { ok: false, error: 'Instance not found' };
      const siblings = getState().instances.filter(i => i.skillId === inst.skillId);
      if (siblings.length <= 1) {
        archiveSkill(inst.skillId, options.reason || 'Compare 归档');
        result.archivedAssetId = inst.skillId;
      } else {
        const det = detachInstance(archiveInstanceId);
        result.detachedInstanceId = archiveInstanceId;
        result.detach = det;
      }
    } else if (archiveAssetId) {
      archiveSkill(archiveAssetId, options.reason || 'Compare 归档');
      result.archivedAssetId = archiveAssetId;
    } else {
      return { ok: false, error: 'archiveAssetId or archiveInstanceId required' };
    }
    const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
    result.resolvedTaskCount = resolved;
    addAuditEvent({
      skillId: result.archivedAssetId || null,
      instanceId: archiveInstanceId || null,
      eventType: 'compare_archive',
      category: 'archive',
      source: 'Skill Panel',
      result: 'completed',
      note: 'Compare 归档候选'
    });
  } else if (action === 'ignore' || action === 'ignore-duplicate' || action === 'ignore_suggestion') {
    // Resolve Duplicate PendingTask ONLY — do NOT create skill_id IgnoreRule
    const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
    addAuditEvent({
      eventType: 'compare_ignore_duplicate',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      note: '忽略本次重复建议（仅关闭 Duplicate PendingTask，未创建 Skill 级 IgnoreRule）'
    });
    result = {
      ...result,
      resolvedTaskCount: resolved,
      ignoreRuleCreated: false,
      skillIgnoreRuleCreated: false
    };
  } else if (action === 'merge-new' || action === 'merge_new') {
    const merged = createMergedAssetFromCandidates(candidateIds, options);
    if (!merged.ok) return merged;
    const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
    addAuditEvent({
      skillId: merged.newAssetId,
      eventType: 'compare_merge_new',
      category: 'system',
      source: 'Skill Panel',
      result: 'completed',
      note: '人工合并为新 Asset · ' + merged.name
    });
    result = { ...result, ...merged, resolvedTaskCount: resolved };
  } else {
    return { ok: false, error: 'Unknown action: ' + action };
  }

  const afterIgnoreCount = (getState().ignoreRules || []).length;
  if (afterIgnoreCount > beforeIgnoreCount && (action === 'ignore' || action === 'ignore-duplicate' || action === 'ignore_suggestion')) {
    // Safety: roll back any accidental skill_id IgnoreRule created during ignore
    const extras = getState().ignoreRules.slice(beforeIgnoreCount).filter(r => r.ruleType === 'skill_id');
    extras.forEach(r => {
      const idx = getState().ignoreRules.findIndex(x => x.id === r.id);
      if (idx >= 0) getState().ignoreRules.splice(idx, 1);
    });
  }
  result.ignoreRuleCreated = false;

  if (session) {
    session.status = 'resolved';
    session.resolvedAt = $now();
    session.resolution = {
      action,
      at: session.resolvedAt,
      primaryAssetId: result.preservedAssetId || result.newAssetId || options.primaryAssetId || null,
      archivedAssetId: result.archivedAssetId || null
    };
  }
  saveState();
  return JSON.parse(JSON.stringify(result));
}

/**
 * Updated openCompare — creates a CompareSession then navigates.
 * Replace the existing openCompare in shared.js with this implementation.
 */
function openCompare(groupIdOrLeft, right, context = {}) {
  saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
  let candidateIds = [];
  let groupId = null;
  if (context.candidateIds && context.candidateIds.length) {
    candidateIds = context.candidateIds.map(id => resolveAssetId(id) || id).filter(Boolean);
  } else if (right) {
    const leftId = resolveAssetId(groupIdOrLeft) || groupIdOrLeft;
    const rightId = resolveAssetId(right) || right;
    candidateIds = [leftId, rightId].filter(Boolean);
  } else {
    groupId = groupIdOrLeft;
    const group = resolveDuplicateGroup(groupIdOrLeft);
    if (group) {
      candidateIds = $coerceArray(group.skillIds).map(id => resolveAssetId(id) || id).filter(Boolean);
      groupId = group.id;
    } else {
      const rid = resolveAssetId(groupIdOrLeft);
      if (rid) candidateIds = [rid];
    }
  }
  // Expand from open duplicate tasks if still short
  if (candidateIds.length < 2 && groupId) {
    getState().pendingTasks
      .filter(t => t.groupId === groupId && t.taskType === 'duplicate_candidate' && t.status === 'open')
      .forEach(t => { if (t.skillId && !candidateIds.includes(t.skillId)) candidateIds.push(t.skillId); });
  }
  const opened = openCompareSession(candidateIds, { groupId: groupId || context.groupId || null });
  const q = new URLSearchParams();
  if (opened.ok && opened.session) q.set('session', opened.session.id);
  if (groupId) q.set('group', groupId);
  if (candidateIds[0]) q.set('left', candidateIds[0]);
  if (candidateIds[1]) q.set('right', candidateIds[1]);
  if (isTestMode()) q.set('dev', '1');
  location.href = 'compare.html?' + q.toString();
}

/* EXPORT LIST for SP object:
 * openCompareSession,
 * getCompareOverview,
 * getCompareFileSummary,
 * getCompareFileDetail,
 * resolveDuplicateComparison,
 * getCompareSession,
 * openCompare  // replace existing
 */
