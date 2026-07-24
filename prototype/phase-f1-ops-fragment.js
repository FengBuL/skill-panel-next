  /* ========== Phase F: Install / Update / Uninstall ========== */
  const PHASE_F_OP_TTL_MS = 15 * 60 * 1000;

  const INSTALL_CATALOG = {
    'github:acme/hello-skill': {
      sourceType: 'github', sourceUrl: 'https://github.com/acme/hello-skill',
      repository: 'acme/hello-skill', branch: 'main', version: '1.2.0', commit: 'abc1234',
      skillName: 'hello-skill', displayName: 'Hello Skill',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: hello-skill\nversion: 1.2.0\n---\n# Hello Skill\n\nSimulated install.\n' },
        { relativePath: 'references/guide.md', fileType: 'text', content: '# Guide\n' },
        { relativePath: 'scripts/setup.sh', fileType: 'text', content: '#!/bin/sh\necho setup\n', executable: true },
        { relativePath: 'assets/icon.bin', fileType: 'binary', content: null, sizeBytes: 128 }
      ],
      nestedSkill: false, trustPolicy: 'untrusted-until-reviewed'
    },
    'git:https://example.com/skills/world.git': {
      sourceType: 'git-url', sourceUrl: 'https://example.com/skills/world.git',
      repository: 'example/world', branch: 'main', version: '0.9.0', commit: 'def5678',
      skillName: 'world-skill', displayName: 'World Skill',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: world-skill\nversion: 0.9.0\n---\n# World\n' },
        { relativePath: 'nested/SKILL.md', fileType: 'text', content: '---\nname: nested-world\n---\n# Nested\n', nested: true }
      ],
      nestedSkill: true, trustPolicy: 'untrusted-until-reviewed'
    },
    'zip-url:https://example.com/pkg.zip': {
      sourceType: 'zip-url', sourceUrl: 'https://example.com/pkg.zip',
      repository: null, branch: null, version: '2.0.0', commit: 'zip0001',
      skillName: 'zip-pkg', displayName: 'Zip Package',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: zip-pkg\nversion: 2.0.0\n---\n# Zip\n' }
      ],
      nestedSkill: false, trustPolicy: 'untrusted-until-reviewed'
    },
    'local-directory:~/Skills/local-demo': {
      sourceType: 'local-directory', sourceUrl: '~/Skills/local-demo',
      repository: null, branch: null, version: '0.1.0', commit: null,
      skillName: 'local-demo', displayName: 'Local Demo',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: local-demo\nversion: 0.1.0\n---\n# Local\n' }
      ],
      nestedSkill: false, trustPolicy: 'local-unreviewed'
    },
    'local-zip:~/Downloads/local-demo.zip': {
      sourceType: 'local-zip', sourceUrl: '~/Downloads/local-demo.zip',
      repository: null, branch: null, version: '0.1.1', commit: null,
      skillName: 'local-zip-demo', displayName: 'Local Zip Demo',
      files: [
        { relativePath: 'SKILL.md', fileType: 'text', content: '---\nname: local-zip-demo\nversion: 0.1.1\n---\n# Local Zip\n' }
      ],
      nestedSkill: false, trustPolicy: 'local-unreviewed'
    }
  };

  function ensurePhaseFCollections() {
    ensureEditorCollections();
    const state = getState();
    if (!state.installOperations) state.installOperations = [];
    if (!state.updateOperations) state.updateOperations = [];
    if (!state.uninstallOperations) state.uninstallOperations = [];
    if (!state.duplicateResolutionOperations) state.duplicateResolutionOperations = [];
    if (!state.installSim) {
      state.installSim = {
        failTargetHost: null,
        updateFailRelativePath: null,
        updateFailInstanceId: null,
        updateRollbackFailInstanceId: null,
        uninstallFailInstanceId: null
      };
    } else {
      if (!('updateFailInstanceId' in state.installSim)) state.installSim.updateFailInstanceId = null;
      if (!('updateRollbackFailInstanceId' in state.installSim)) state.installSim.updateRollbackFailInstanceId = null;
      if (!('uninstallFailInstanceId' in state.installSim)) state.installSim.uninstallFailInstanceId = null;
    }
  }

  function fileListHashForInstance(instanceId) {
    const files = getFilesRawInternal({ instanceId }).slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return $hash(files.map(f => f.relativePath).join('|'));
  }

  function isAssetInstallable(asset) {
    if (!asset) return false;
    if (asset.lifecycleStatus === 'deleted') return false;
    if (asset.mergedIntoAssetId) return false;
    return true;
  }

  function listInstallableAssets() {
    ensurePhaseFCollections();
    return getState().assets
      .filter(isAssetInstallable)
      .map(a => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName || a.name,
        lifecycleStatus: a.lifecycleStatus,
        primaryInstanceId: a.primaryInstanceId || null,
        sourceBindingId: a.sourceBindingId || null,
        instanceCount: getState().instances.filter(i => i.skillId === a.id).length
      }));
  }

  function sourceKeyOf(src) {
    if (!src) return '';
    return String(src.sourceType || '') + '::' + String(src.repository || src.sourceUrl || '');
  }

  function isLocalSourceType(sourceType) {
    return sourceType === 'local-directory' || sourceType === 'local-zip';
  }

  function isGithubLikeSourceType(sourceType) {
    return sourceType === 'github' || sourceType === 'git-url';
  }

  function validateInstallHost(hostId) {
    const host = getState().hosts.find(h => h.id === hostId);
    if (!host) return { ok: false, code: 'host_not_found', error: 'Host 不存在: ' + hostId, host: null };
    if (host.enabled === false) return { ok: false, code: 'host_disabled', error: 'Host 已禁用: ' + hostId, host };
    if (!host.path) return { ok: false, code: 'host_not_found', error: 'Host 无有效路径: ' + hostId, host };
    if (host.permissionStatus !== 'granted') {
      return { ok: false, code: 'permission-denied', error: '目标 Host 无权限', host };
    }
    return { ok: true, host };
  }

  function resolveInstallSource(input) {
    ensurePhaseFCollections();
    const raw = String(input || '').trim();
    let key = raw;
    if (/^https:\/\/github\.com\//i.test(raw)) {
      const m = raw.match(/github\.com\/([^\/]+\/[^\/#?]+)/i);
      key = 'github:' + (m ? m[1].replace(/\.git$/, '') : 'acme/hello-skill');
    } else if (/^git(@|\+|https?:)/i.test(raw) || /\.git$/i.test(raw)) {
      key = 'git:https://example.com/skills/world.git';
    } else if (/\.zip$/i.test(raw) && /^https?:/i.test(raw)) {
      key = 'zip-url:https://example.com/pkg.zip';
    } else if (/\.zip$/i.test(raw)) {
      key = 'local-zip:~/Downloads/local-demo.zip';
    } else if (raw.startsWith('~/') || raw.startsWith('/')) {
      key = Object.keys(INSTALL_CATALOG).find(k => k.startsWith('local-directory')) || 'local-directory:~/Skills/local-demo';
    } else if (!INSTALL_CATALOG[key]) {
      key = Object.keys(INSTALL_CATALOG).find(k => INSTALL_CATALOG[k].skillName === raw) || 'github:acme/hello-skill';
    }
    const cat = INSTALL_CATALOG[key];
    if (!cat) return { ok: false, error: 'Unknown source', code: 'unknown_source' };
    const textCount = cat.files.filter(f => f.fileType === 'text').length;
    const binaryCount = cat.files.filter(f => f.fileType === 'binary').length;
    const risks = [];
    if (cat.files.some(f => f.executable)) risks.push({ code: 'executable', severity: 'high', message: '包含可执行脚本（不会执行）' });
    if (cat.nestedSkill) risks.push({ code: 'nested_skill', severity: 'medium', message: '包含 Nested SKILL.md' });
    if (cat.trustPolicy !== 'trusted') risks.push({ code: 'untrusted', severity: 'medium', message: '来源未自动信任' });
    return JSON.parse(JSON.stringify({
      ok: true,
      catalogKey: key,
      sourceType: cat.sourceType,
      sourceUrl: cat.sourceUrl,
      repository: cat.repository,
      branch: cat.branch,
      version: cat.version,
      commit: cat.commit,
      skillName: cat.skillName,
      displayName: cat.displayName,
      fileTree: cat.files.map(f => ({
        relativePath: f.relativePath, fileType: f.fileType,
        sizeBytes: f.sizeBytes != null ? f.sizeBytes : (f.content ? f.content.length : 0),
        nested: !!f.nested, executable: !!f.executable
      })),
      counts: { text: textCount, binary: binaryCount, total: cat.files.length, nested: cat.files.filter(f => f.nested).length },
      risks,
      trustPolicy: cat.trustPolicy,
      simulated: true,
      note: '确定性模拟解析，无真实网络请求'
    }));
  }

  function analyzeInstallConflicts(resolved, hostId) {
    const validated = validateInstallHost(hostId);
    if (!validated.ok) {
      return {
        host: null,
        targetPath: null,
        issues: [{ code: validated.code, severity: 'high', message: validated.error }],
        sameNameAssets: [],
        hostError: validated
      };
    }
    const host = validated.host;
    const sameName = getState().assets.filter(a => a.name === resolved.skillName && isAssetInstallable(a));
    const targetPath = (host.path || '~/.skills') + '/' + resolved.skillName + '/SKILL.md';
    const pathClash = getState().instances.find(i =>
      i.skillFilePath === targetPath &&
      i.lifecycleStatus !== 'deleted' &&
      i.lifecycleStatus !== 'stopped' &&
      i.lifecycleStatus !== 'removed-from-host-simulated' &&
      i.lifecycleStatus !== 'missing'
    );
    const issues = [];
    if (sameName.length) issues.push({ code: 'same_name_asset', severity: 'medium', assetIds: sameName.map(a => a.id), message: '存在同名 Asset' });
    if (pathClash) issues.push({ code: 'path_conflict', severity: 'high', instanceId: pathClash.id, message: '目标路径已有 Instance' });
    return { host, targetPath, issues, sameNameAssets: sameName.map(a => ({ id: a.id, name: a.name })) };
  }

  function emptyInstallDelta() {
    return {
      createdAssetIds: [],
      createdInstanceIds: [],
      createdFileIds: [],
      createdBindingIds: [],
      createdSnapshotIds: []
    };
  }

  function rollbackInstallDelta(delta) {
    if (!delta) return;
    const state = getState();
    const fileIds = new Set(delta.createdFileIds || []);
    const instIds = new Set(delta.createdInstanceIds || []);
    const bindingIds = new Set(delta.createdBindingIds || []);
    const snapIds = new Set(delta.createdSnapshotIds || []);
    const assetIds = new Set(delta.createdAssetIds || []);
    state.files = state.files.filter(f => !fileIds.has(f.id));
    state.instances = state.instances.filter(i => !instIds.has(i.id));
    state.sourceBindings = state.sourceBindings.filter(b => !bindingIds.has(b.id));
    state.snapshots = state.snapshots.filter(s => !snapIds.has(s.id));
    state.assets = state.assets.filter(a => !assetIds.has(a.id));
  }

  function prepareInstall(options = {}) {
    ensurePhaseFCollections();
    const resolved = options.resolved || resolveInstallSource(options.source || options.sourceInput || 'github:acme/hello-skill');
    if (!resolved.ok) return resolved;
    const hostIds = $coerceArray(options.hostIds || options.targets || [(options.hostId || 'claude')]);
    if (!hostIds.length) return { ok: false, code: 'no_target', error: '未选择目标 Host' };
    const mode = options.mode || 'new-asset'; // new-asset | add-instance | rebind | cancel
    if (mode === 'cancel') return { ok: false, code: 'cancelled', error: '用户取消' };

    const existingAssetId = resolveAssetId(options.existingAssetId) || options.existingAssetId || null;
    const existingInstanceId = options.existingInstanceId || null;

    if (mode === 'add-instance') {
      if (!existingAssetId) return { ok: false, code: 'asset_required', error: '作为现有 Asset 的新 Instance 需要 existingAssetId' };
      const asset = getAssetRaw(existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除' };
      }
    }
    if (mode === 'rebind') {
      if (!existingAssetId || !existingInstanceId) {
        return { ok: false, code: 'rebind_required', error: 'rebind 需要 existingAssetId 与 existingInstanceId' };
      }
      const asset = getAssetRaw(existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除' };
      }
      const inst = getInstanceRaw(existingInstanceId);
      if (!inst || inst.skillId !== existingAssetId) {
        return { ok: false, code: 'instance_not_found', error: '目标 Instance 不存在或不属于该 Asset' };
      }
      if (inst.lifecycleStatus !== 'missing' && inst.lifecycleStatus !== 'stopped') {
        return { ok: false, code: 'rebind_not_allowed', error: '仅 Missing / Stopped Instance 允许 rebind' };
      }
    }

    const targets = [];
    const allIssues = [];
    for (const hid of hostIds) {
      const analysis = analyzeInstallConflicts(resolved, hid);
      if (analysis.hostError) {
        return {
          ok: false,
          code: analysis.hostError.code,
          error: analysis.hostError.error,
          issues: analysis.issues,
          resolved
        };
      }
      // For rebind, ignore path clash against the same instance being rebound
      const issues = (analysis.issues || []).filter(i => {
        if (mode === 'rebind' && i.code === 'path_conflict' && i.instanceId === existingInstanceId) return false;
        return true;
      });
      allIssues.push(...issues.map(i => Object.assign({ hostId: hid }, i)));
      targets.push({
        hostId: hid,
        hostName: analysis.host ? analysis.host.name : hid,
        hostType: analysis.host ? analysis.host.hostType : null,
        targetPath: analysis.targetPath,
        permissionOk: !(issues || []).some(i => i.code === 'permission-denied'),
        pathConflict: (issues || []).some(i => i.code === 'path_conflict')
      });
    }

    if (allIssues.some(i => i.code === 'path_conflict')) {
      return { ok: false, code: 'path_conflict', error: '同路径冲突被阻止', issues: allIssues, resolved, targets };
    }
    if (allIssues.some(i => i.code === 'permission-denied')) {
      return { ok: false, code: 'permission-denied', error: '目标权限不足', issues: allIssues, resolved, targets };
    }
    if (mode === 'rebind' && targets.length !== 1) {
      return { ok: false, code: 'rebind_single_target', error: 'rebind 仅支持单个目标 Host' };
    }

    const preparedAt = $now();
    const catalog = INSTALL_CATALOG[resolved.catalogKey];
    const confirmationHash = $hash(JSON.stringify({
      catalogKey: resolved.catalogKey, mode, existingAssetId, existingInstanceId, targets: targets.map(t => t.targetPath)
    }));
    const op = {
      id: uuid(),
      type: 'install',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: {
        catalogKey: resolved.catalogKey,
        sourceType: resolved.sourceType,
        sourceUrl: resolved.sourceUrl,
        repository: resolved.repository,
        branch: resolved.branch,
        version: resolved.version,
        commit: resolved.commit,
        skillName: resolved.skillName,
        displayName: resolved.displayName,
        trustPolicy: resolved.trustPolicy
      },
      mode,
      existingAssetId,
      existingInstanceId,
      targets,
      issues: allIssues,
      fileManifest: (catalog.files || []).map(f => ({
        relativePath: f.relativePath, fileType: f.fileType,
        contentHash: f.content ? $hash(f.content) : null,
        executable: !!f.executable, nested: !!f.nested
      })),
      checkpointId: null,
      snapshotIds: [],
      confirmationHash,
      results: [],
      confirmedAt: null,
      completedAt: null
    };
    op.checkpointId = uuid();
    op._checkpoint = {
      id: op.checkpointId,
      deltas: []
    };
    getState().installOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      stage: 'confirmation',
      resolved,
      targets,
      issues: allIssues,
      mode,
      existingAssetId,
      existingInstanceId,
      risks: resolved.risks,
      confirmationHash,
      simulated: true
    }));
  }

  function writeInstallFiles(assetId, instanceId, catalog, now, delta) {
    catalog.files.forEach(f => {
      const fid = uuid();
      getState().files.push(normalizeFile({
        id: fid, instanceId, skillId: assetId,
        relativePath: f.relativePath,
        fileType: f.fileType || 'text',
        mimeType: f.fileType === 'binary' ? 'application/octet-stream' : 'text/markdown',
        sizeBytes: f.content ? f.content.length : (f.sizeBytes || 0),
        content: f.fileType === 'binary' ? null : String(f.content || ''),
        contentHash: f.content ? $hash(f.content) : ('bin-' + (f.sizeBytes || 0)),
        modifiedAt: now,
        tokenCount: f.content ? $tokenApprox(f.content) : 0,
        tokenCountMode: 'estimated',
        indexStatus: 'indexed',
        isNestedSkillMarker: !!f.nested
      }));
      delta.createdFileIds.push(fid);
    });
  }

  function ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, mode) {
    const asset = getAssetRaw(assetId);
    const existingAssetBinding = asset && asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId && (!b.scope || b.scope === 'asset'));
    const incomingKey = sourceKeyOf(op.source);
    const existingKey = sourceKeyOf(existingAssetBinding);
    const sameSource = !!existingAssetBinding && incomingKey === existingKey;

    if (mode === 'new-asset') {
      if (existingAssetBinding) return existingAssetBinding;
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId: null,
        scope: 'asset',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: false
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      if (asset) asset.sourceBindingId = binding.id;
      return binding;
    }

    // add-instance / rebind
    if (sameSource && existingAssetBinding) {
      return existingAssetBinding;
    }

    // Local must not overwrite existing GitHub asset binding
    if (existingAssetBinding && isGithubLikeSourceType(existingAssetBinding.sourceType) && isLocalSourceType(op.source.sourceType)) {
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId,
        scope: 'instance',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: true
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      const inst = getInstanceRaw(instanceId);
      if (inst) inst.sourceBindingId = binding.id;
      return binding;
    }

    if (existingAssetBinding && !sameSource) {
      const binding = normalizeSourceBinding({
        id: uuid(),
        skillId: assetId,
        instanceId,
        scope: 'instance',
        sourceType: op.source.sourceType,
        sourceUrl: op.source.sourceUrl,
        repository: op.source.repository,
        branch: op.source.branch,
        baselineVersion: op.source.version,
        baselineCommit: op.source.commit,
        baselineSnapshotId: snapId || null,
        trustPolicy: op.source.trustPolicy,
        lastCheckedAt: now,
        updateStatus: 'up-to-date',
        remoteVersion: op.source.version,
        remoteCommit: op.source.commit,
        sourceDivergence: true
      });
      getState().sourceBindings.push(binding);
      delta.createdBindingIds.push(binding.id);
      const inst = getInstanceRaw(instanceId);
      if (inst) inst.sourceBindingId = binding.id;
      // do NOT overwrite asset.sourceBindingId
      return binding;
    }

    // no existing binding — create asset-level
    const binding = normalizeSourceBinding({
      id: uuid(),
      skillId: assetId,
      instanceId: null,
      scope: 'asset',
      sourceType: op.source.sourceType,
      sourceUrl: op.source.sourceUrl,
      repository: op.source.repository,
      branch: op.source.branch,
      baselineVersion: op.source.version,
      baselineCommit: op.source.commit,
      baselineSnapshotId: snapId || null,
      trustPolicy: op.source.trustPolicy,
      lastCheckedAt: now,
      updateStatus: 'up-to-date',
      remoteVersion: op.source.version,
      remoteCommit: op.source.commit,
      sourceDivergence: false
    });
    getState().sourceBindings.push(binding);
    delta.createdBindingIds.push(binding.id);
    if (asset && !asset.sourceBindingId) asset.sourceBindingId = binding.id;
    return binding;
  }

  function confirmInstall(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed', error: '需要用户确认' };
    const op = getState().installOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    for (const t of op.targets) {
      const clash = getState().instances.find(i =>
        i.skillFilePath === t.targetPath &&
        i.lifecycleStatus !== 'deleted' &&
        i.lifecycleStatus !== 'stopped' &&
        i.lifecycleStatus !== 'removed-from-host-simulated' &&
        i.lifecycleStatus !== 'missing' &&
        !(op.mode === 'rebind' && i.id === op.existingInstanceId)
      );
      if (clash) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'path_conflict', error: '确认前再次检查发现路径冲突', operationId };
      }
      const hv = validateInstallHost(t.hostId);
      if (!hv.ok) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: hv.code, error: hv.error, operationId };
      }
    }

    if (op.mode === 'add-instance') {
      const asset = getAssetRaw(op.existingAssetId);
      if (!asset || !isAssetInstallable(asset)) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'asset_not_found', error: '目标 Asset 不存在或已合并/删除', operationId };
      }
    }
    if (op.mode === 'rebind') {
      const asset = getAssetRaw(op.existingAssetId);
      const inst = getInstanceRaw(op.existingInstanceId);
      if (!asset || !isAssetInstallable(asset) || !inst || inst.skillId !== op.existingAssetId) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'asset_not_found', error: 'rebind 目标无效', operationId };
      }
    }

    op.confirmedAt = $now();
    op.status = 'installing';
    const catalog = INSTALL_CATALOG[op.source.catalogKey];
    const results = [];
    const sim = getState().installSim || {};
    const allDeltas = [];
    let sharedAssetId = null;
    let sharedAssetCreated = false;
    let sharedBindingId = null;
    let anyOk = false;
    let anyFail = false;

    if (op.mode === 'new-asset') {
      sharedAssetId = uuid();
      const now = $now();
      getState().assets.push(normalizeAsset({
        id: sharedAssetId,
        name: op.source.skillName,
        displayName: op.source.displayName || catalog.displayName || op.source.skillName,
        description: 'Installed via simulated source',
        categoryIds: [], tagIds: [],
        lifecycleStatus: 'available',
        primaryInstanceId: null,
        supportedHosts: [],
        createdAt: now, updatedAt: now
      }));
      sharedAssetCreated = true;
    } else if (op.mode === 'add-instance' || op.mode === 'rebind') {
      sharedAssetId = op.existingAssetId;
    }

    op.targets.forEach((t, targetIndex) => {
      const delta = emptyInstallDelta();
      // NOTE: shared new-asset UUID is NOT part of per-target rollback delta.
      // It is only deleted when ALL targets fail.

      if (sim.failTargetHost && sim.failTargetHost === t.hostId) {
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'failed', errorCode: 'sim_fail', message: '模拟安装失败' });
        anyFail = true;
        allDeltas.push({ hostId: t.hostId, delta, success: false });
        return;
      }

      try {
        const now = $now();
        const host = getState().hosts.find(h => h.id === t.hostId);
        const hostType = host ? host.hostType : 'claude-code';
        let assetId = sharedAssetId;
        let instanceId = null;

        if (op.mode === 'rebind') {
          instanceId = op.existingInstanceId;
          const inst = getInstanceRaw(instanceId);
          // remove old files for this instance
          getState().files = getState().files.filter(f => f.instanceId !== instanceId);
          inst.hostType = hostType;
          inst.rootPath = t.targetPath.replace(/\/SKILL\.md$/, '');
          inst.skillFilePath = t.targetPath;
          inst.lifecycleStatus = 'available';
          inst.permissionMode = 'managed';
          inst.installedVersion = op.source.version || '0.1.0';
          inst.healthStatuses = ['normal'];
          inst.lastSeenAt = now;
          inst.contentHash = $hash((catalog.files.find(f => f.relativePath === 'SKILL.md') || {}).content || '');
          inst.fileCount = catalog.files.length;
          inst.packageSizeBytes = catalog.files.reduce((n, f) => n + (f.content ? f.content.length : (f.sizeBytes || 0)), 0);
          inst.localModificationStatus = 'clean';
          writeInstallFiles(assetId, instanceId, catalog, now, delta);
        } else {
          instanceId = uuid();
          const hasPrimary = getState().instances.some(i => i.skillId === assetId && i.isPrimary && i.lifecycleStatus === 'available');
          getState().instances.push(normalizeInstance({
            id: instanceId, skillId: assetId, hostType,
            rootPath: t.targetPath.replace(/\/SKILL\.md$/, ''),
            skillFilePath: t.targetPath,
            lifecycleStatus: 'available', permissionMode: 'managed',
            installedVersion: op.source.version || '0.1.0',
            healthStatuses: ['normal'],
            isPrimary: !hasPrimary,
            lastSeenAt: now,
            contentHash: $hash((catalog.files.find(f => f.relativePath === 'SKILL.md') || {}).content || ''),
            fileCount: catalog.files.length,
            packageSizeBytes: catalog.files.reduce((n, f) => n + (f.content ? f.content.length : (f.sizeBytes || 0)), 0),
            localModificationStatus: 'clean'
          }));
          delta.createdInstanceIds.push(instanceId);
          writeInstallFiles(assetId, instanceId, catalog, now, delta);
        }

        const asset = getAssetRaw(assetId);
        if (asset) {
          const hosts = $coerceArray(asset.supportedHosts);
          if (t.hostId && !hosts.includes(t.hostId)) hosts.push(t.hostId);
          asset.supportedHosts = hosts;
          if (!asset.primaryInstanceId) {
            const primary = getState().instances.find(i => i.skillId === assetId && i.isPrimary) || getInstanceRaw(instanceId);
            asset.primaryInstanceId = primary ? primary.id : instanceId;
          }
          asset.updatedAt = now;
        }

        const snap = createPackageSnapshotForInstance(instanceId, {
          note: op.mode === 'rebind' ? 'Rebind 基线 Package Snapshot' : '安装基线 Package Snapshot',
          source: op.mode === 'rebind' ? 'install-rebind' : 'install-baseline',
          retained: true
        });
        let snapId = null;
        if (snap) {
          getState().snapshots.push(snap);
          op.snapshotIds.push(snap.id);
          delta.createdSnapshotIds.push(snap.id);
          snapId = snap.id;
        }

        // ONE asset-level binding for new-asset (shared); add-instance may diverge
        let binding = null;
        if (op.mode === 'new-asset') {
          if (!sharedBindingId) {
            binding = ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, 'new-asset');
            sharedBindingId = binding.id;
          } else {
            binding = getState().sourceBindings.find(b => b.id === sharedBindingId);
          }
        } else {
          binding = ensureInstallSourceBinding(op, assetId, instanceId, snapId, now, delta, op.mode);
        }

        addAuditEvent({
          skillId: assetId, instanceId,
          eventType: op.mode === 'rebind' ? 'install_rebind' : 'install_completed',
          category: 'install',
          source: 'Skill Panel', result: 'completed', snapshotId: snapId,
          note: (op.mode === 'rebind' ? '模拟 Rebind · ' : '模拟安装 · ') + op.source.skillName + ' → ' + t.targetPath
        });
        results.push({
          hostId: t.hostId, targetPath: t.targetPath, status: 'completed',
          assetId, instanceId, snapshotId: snapId, bindingId: binding ? binding.id : null
        });
        anyOk = true;
        allDeltas.push({ hostId: t.hostId, delta, success: true });
      } catch (e) {
        rollbackInstallDelta(delta);
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'failed', errorCode: 'exception', message: String(e.message || e) });
        anyFail = true;
        allDeltas.push({ hostId: t.hostId, delta: emptyInstallDelta(), success: false });
      }
    });

    op._checkpoint.deltas = allDeltas;

    if (anyFail && !anyOk) {
      // ALL targets failed — delete created Asset and all its created entities
      const union = emptyInstallDelta();
      allDeltas.forEach(d => {
        (d.delta.createdAssetIds || []).forEach(id => union.createdAssetIds.push(id));
        (d.delta.createdInstanceIds || []).forEach(id => union.createdInstanceIds.push(id));
        (d.delta.createdFileIds || []).forEach(id => union.createdFileIds.push(id));
        (d.delta.createdBindingIds || []).forEach(id => union.createdBindingIds.push(id));
        (d.delta.createdSnapshotIds || []).forEach(id => union.createdSnapshotIds.push(id));
      });
      if (sharedAssetCreated) {
        // also sweep by asset id in case delta missed
        const aid = sharedAssetId;
        getState().files = getState().files.filter(f => f.skillId !== aid);
        getState().instances = getState().instances.filter(i => i.skillId !== aid);
        getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== aid);
        getState().snapshots = getState().snapshots.filter(s => s.skillId !== aid);
        getState().assets = getState().assets.filter(a => a.id !== aid);
      } else {
        rollbackInstallDelta(union);
      }
      op.status = 'failed';
      op.results = results;
      op.completedAt = $now();
      addAuditEvent({ eventType: 'install_failed', category: 'install', source: 'Skill Panel', result: 'failed', note: '安装失败，已清理半成品' });
      saveState();
      return JSON.parse(JSON.stringify({ ok: false, status: 'failed', operationId, results }));
    }

    // Partial fail: successful instances kept; failed targets already rolled back at exception path.
    // Sim-fail path created no entities for that target (except possibly shared asset which is kept if anyOk).
    if (sharedAssetCreated && anyOk) {
      const asset = getAssetRaw(sharedAssetId);
      if (asset) {
        const hosts = results.filter(r => r.status === 'completed').map(r => r.hostId);
        asset.supportedHosts = Array.from(new Set(hosts));
        const primaries = getState().instances.filter(i => i.skillId === sharedAssetId && i.isPrimary);
        if (primaries.length > 1) {
          primaries.slice(1).forEach(i => { i.isPrimary = false; });
        }
        if (!getState().instances.some(i => i.skillId === sharedAssetId && i.isPrimary)) {
          const first = getState().instances.find(i => i.skillId === sharedAssetId);
          if (first) {
            first.isPrimary = true;
            asset.primaryInstanceId = first.id;
          }
        } else {
          asset.primaryInstanceId = getState().instances.find(i => i.skillId === sharedAssetId && i.isPrimary).id;
        }
      }
    }

    op.status = (anyFail && anyOk) ? 'partially-completed' : 'completed';
    op.results = results;
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: !anyFail,
      status: op.status,
      operationId,
      results,
      assetId: sharedAssetId,
      snapshotIds: op.snapshotIds
    }));
  }

  function getInstallOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().installOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function loadInstallDemoCase(caseId) {
    ensurePhaseFCollections();
    const sim = getState().installSim;
    sim.failTargetHost = null;
    if (caseId === 'fail-codex') sim.failTargetHost = 'codex';
    else if (caseId === 'clear') { /* noop */ }
    else return { ok: false, error: 'Unknown case' };
    saveState();
    return { ok: true, caseId };
  }

  function openInstallPage(context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const q = new URLSearchParams();
    if (context.source) q.set('source', context.source);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'install.html' + (q.toString() ? ('?' + q.toString()) : '');
  }

  /* ----- Update ----- */
  function checkForUpdates(assetIdOrInstanceId) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(assetIdOrInstanceId) || (getInstanceRaw(assetIdOrInstanceId) || {}).skillId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const asset = getAssetRaw(assetId);
    const binding = asset && asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId);
    if (!binding) {
      return { ok: true, updateStatus: 'no-source', message: '本地 Skill 无 SourceBinding，无法检查更新' };
    }
    const sim = getState().installSim || {};
    const remoteVersion = sim.remoteVersion || binding.remoteVersion || bumpVersion(binding.baselineVersion || '1.0.0');
    const remoteCommit = sim.remoteCommit || ('r' + $hash(remoteVersion).slice(0, 7));
    const available = sim.forceUpdateAvailable || (remoteVersion !== binding.baselineVersion);
    binding.lastCheckedAt = $now();
    binding.remoteVersion = remoteVersion;
    binding.remoteCommit = remoteCommit;
    binding.updateStatus = available ? 'update-available' : 'up-to-date';
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      assetId,
      updateStatus: binding.updateStatus,
      baselineVersion: binding.baselineVersion,
      baselineCommit: binding.baselineCommit,
      remoteVersion,
      remoteCommit,
      baselineSnapshotId: binding.baselineSnapshotId,
      trustPolicy: binding.trustPolicy
    }));
  }

  function bumpVersion(v) {
    const parts = String(v || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    parts[2] += 1;
    return parts.join('.');
  }

  function buildRemoteCandidateFiles(assetId, binding) {
    const inst = getState().instances.find(i => i.skillId === assetId && i.isPrimary) || getState().instances.find(i => i.skillId === assetId);
    if (!inst) return [];
    const files = getFilesRawInternal({ instanceId: inst.id });
    return files.map(f => {
      if (f.fileType === 'binary') {
        return { fileId: f.id, relativePath: f.relativePath, fileType: 'binary', content: null, contentHash: f.contentHash, changed: false, sizeBytes: f.sizeBytes || 0 };
      }
      let content = String(f.content || '');
      if (f.relativePath === 'SKILL.md') {
        content = content.replace(/version:\s*[^\n]+/, 'version: ' + (binding.remoteVersion || '9.9.9'));
        if (!/REMOTE_UPDATE_MARKER/.test(content)) content += '\n\n<!-- REMOTE_UPDATE_MARKER -->\n';
      } else if (f.relativePath.indexOf('references/') === 0) {
        content = content + '\n\n<!-- remote ref update -->\n';
      }
      return {
        fileId: f.id, relativePath: f.relativePath, fileType: 'text',
        content, contentHash: $hash(content),
        changed: content !== String(f.content || ''),
        sizeBytes: content.length
      };
    });
  }

  function cancelUpdateOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    op.status = 'cancelled';
    op.completedAt = $now();
    saveState();
    return { ok: true, operationId, status: 'cancelled' };
  }

  function prepareUpdate(options = {}) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const check = checkForUpdates(assetId);
    if (check.updateStatus === 'up-to-date' && !options.force) {
      return { ok: true, updateStatus: 'up-to-date', wrote: false, message: '无更新，不创建写入 Operation' };
    }
    if (check.updateStatus === 'no-source') return check;
    const asset = getAssetRaw(assetId);
    const binding = getState().sourceBindings.find(b => b.id === (asset && asset.sourceBindingId)) ||
      getState().sourceBindings.find(b => b.skillId === assetId);
    if (!binding) return { ok: false, code: 'no-source' };

    const instanceIds = $coerceArray(options.instanceIds);
    const allInst = getState().instances.filter(i => i.skillId === assetId && i.lifecycleStatus !== 'missing');
    const targets = (instanceIds.length ? allInst.filter(i => instanceIds.includes(i.id)) : allInst).map(i => ({
      instanceId: i.id, hostType: i.hostType, path: i.skillFilePath
    }));
    if (!targets.length) return { ok: false, code: 'no_target' };

    for (const t of targets) {
      const perm = getInstancePermission(t.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied', error: '无写权限' };
    }

    const remoteFiles = buildRemoteCandidateFiles(assetId, binding);
    const fileStrategies = Object.assign({}, options.fileStrategies || {});
    const selectedPaths = options.selectedRelativePaths
      ? $coerceArray(options.selectedRelativePaths)
      : (Object.keys(fileStrategies).length
        ? Object.keys(fileStrategies).filter(p => fileStrategies[p] === 'use-remote' || fileStrategies[p] === 'manual-merge')
        : remoteFiles.filter(f => f.changed).map(f => f.relativePath));

    // default strategies for selected paths
    selectedPaths.forEach(p => {
      if (!fileStrategies[p]) fileStrategies[p] = 'use-remote';
    });

    const remoteAdds = $coerceArray(options.remoteAdds);
    const remoteDeletes = $coerceArray(options.remoteDeletes);

    const snapIds = [];
    const snapshotIdByInstanceId = {};
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '更新前 Package Snapshot', source: 'pre-update', retained: true
      });
      if (snap) {
        getState().snapshots.push(snap);
        snapIds.push(snap.id);
        snapshotIdByInstanceId[t.instanceId] = snap.id;
      }
    });
    if (!snapIds.length) return { ok: false, code: 'snapshot_failed' };

    const preparedAt = $now();
    const preparedFileStates = targets.map(t => {
      const inst = getInstanceRaw(t.instanceId);
      const files = getFilesRawInternal({ instanceId: t.instanceId });
      return {
        instanceId: t.instanceId,
        packageHash: packageHashForInstance(t.instanceId),
        fileListHash: fileListHashForInstance(t.instanceId),
        fileCount: files.length,
        sourceBindingId: (inst && inst.sourceBindingId) || (asset && asset.sourceBindingId) || binding.id,
        lifecycleStatus: inst ? inst.lifecycleStatus : null,
        path: inst ? inst.skillFilePath : null,
        files: files.map(f => ({
          fileId: f.id,
          relativePath: f.relativePath,
          exists: true,
          contentHash: f.contentHash,
          modifiedAt: f.modifiedAt,
          sizeBytes: f.sizeBytes
        }))
      };
    });

    const op = {
      id: uuid(),
      type: 'update',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId, bindingId: binding.id },
      targets,
      selectedRelativePaths: selectedPaths,
      fileStrategies,
      remoteAdds,
      remoteDeletes,
      remoteFiles: remoteFiles.map(f => ({
        fileId: f.fileId, relativePath: f.relativePath, fileType: f.fileType,
        contentHash: f.contentHash, changed: f.changed, sizeBytes: f.sizeBytes
      })),
      _remoteContents: remoteFiles.reduce((m, f) => { m[f.relativePath] = f.content; return m; }, {}),
      baselineSnapshotId: binding.baselineSnapshotId,
      snapshotIds: snapIds,
      snapshotIdByInstanceId,
      preparedFileStates,
      preparedBindingSnapshot: {
        id: binding.id,
        baselineSnapshotId: binding.baselineSnapshotId,
        remoteVersion: binding.remoteVersion,
        remoteCommit: binding.remoteCommit,
        updateStatus: binding.updateStatus
      },
      confirmationHash: $hash(JSON.stringify({ assetId, selectedPaths, fileStrategies, snapIds })),
      remoteVersion: binding.remoteVersion,
      remoteCommit: binding.remoteCommit,
      results: [],
      confirmedAt: null,
      completedAt: null
    };
    getState().updateOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      updateStatus: 'update-available',
      targets,
      selectedRelativePaths: selectedPaths,
      fileStrategies,
      remoteAdds,
      remoteDeletes,
      fileSummary: remoteFiles.map(f => ({ relativePath: f.relativePath, changed: f.changed, fileType: f.fileType })),
      snapshotIds: snapIds,
      remoteVersion: binding.remoteVersion,
      baselineVersion: binding.baselineVersion
    }));
  }

  function getUpdateThreeWayDiff(operationId, fileIdOrPath) {
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return null;
    const instId = op.targets[0] && op.targets[0].instanceId;
    const file = getFilesRawInternal({ instanceId: instId }).find(f => f.id === fileIdOrPath || f.relativePath === fileIdOrPath);
    if (!file) return null;
    const baseSnap = getState().snapshots.find(s => s.id === op.baselineSnapshotId);
    const baseRec = baseSnap && (baseSnap.files || []).find(f => f.relativePath === file.relativePath);
    const base = baseRec && baseRec.content != null ? String(baseRec.content) : String(file.content || '');
    const local = file.fileType === 'binary' ? null : String(file.content || '');
    const remote = op._remoteContents ? op._remoteContents[file.relativePath] : null;
    return JSON.parse(JSON.stringify({
      relativePath: file.relativePath,
      base, local, remote,
      baseToLocal: lineDiffSafe(base || '', local || ''),
      localToRemote: lineDiffSafe(local || '', remote || ''),
      baseToRemote: lineDiffSafe(base || '', remote || '')
    }));
  }

  function recheckUpdatePrepared(op) {
    const binding = getState().sourceBindings.find(b => b.id === op.source.bindingId);
    if (!binding) return { ok: false, code: 'conflict', error: 'SourceBinding 已变化' };
    const prepB = op.preparedBindingSnapshot || {};
    if (binding.id !== prepB.id) return { ok: false, code: 'conflict', error: 'SourceBinding 已变化' };
    if (binding.baselineSnapshotId !== prepB.baselineSnapshotId) return { ok: false, code: 'conflict', error: 'Baseline Snapshot 已变化' };
    if (binding.remoteVersion !== prepB.remoteVersion || binding.remoteCommit !== prepB.remoteCommit) {
      return { ok: false, code: 'conflict', error: 'Remote Version/Commit 已变化' };
    }
    if (op.remoteVersion !== binding.remoteVersion || op.remoteCommit !== binding.remoteCommit) {
      return { ok: false, code: 'conflict', error: 'Operation 与当前 Remote 不一致' };
    }

    for (const group of op.preparedFileStates) {
      const inst = getInstanceRaw(group.instanceId);
      if (!inst || inst.lifecycleStatus === 'missing') {
        return { ok: false, code: 'conflict', error: 'Instance 缺失' };
      }
      if (group.lifecycleStatus && inst.lifecycleStatus !== group.lifecycleStatus) {
        return { ok: false, code: 'conflict', error: 'Instance 生命周期已变化' };
      }
      if (group.path && inst.skillFilePath !== group.path) {
        return { ok: false, code: 'conflict', error: 'Instance 路径已变化' };
      }
      const curBindingId = inst.sourceBindingId || (getAssetRaw(op.source.assetId) || {}).sourceBindingId || binding.id;
      if (group.sourceBindingId && curBindingId !== group.sourceBindingId) {
        return { ok: false, code: 'conflict', error: 'Instance SourceBinding 已变化' };
      }
      const perm = getInstancePermission(group.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied' };

      const curFiles = getFilesRawInternal({ instanceId: group.instanceId });
      const curPaths = curFiles.map(f => f.relativePath).slice().sort().join('|');
      const prepPaths = group.files.map(f => f.relativePath).slice().sort().join('|');
      if (curPaths !== prepPaths) {
        return { ok: false, code: 'conflict', error: '文件列表已变化（新增/删除/重命名）' };
      }
      if (fileListHashForInstance(group.instanceId) !== group.fileListHash) {
        return { ok: false, code: 'conflict', error: '文件列表 Hash 已变化' };
      }
      if (packageHashForInstance(group.instanceId) !== group.packageHash) {
        return { ok: false, code: 'conflict', error: 'Package Hash 已变化' };
      }
      if (curFiles.length !== group.fileCount) {
        return { ok: false, code: 'conflict', error: '文件数量已变化' };
      }
      for (const prep of group.files) {
        const cur = getFileRawInternal(prep.fileId);
        if (!cur || !prep.exists) {
          return { ok: false, code: 'conflict', error: '确认前文件状态已变化' };
        }
        if (cur.contentHash !== prep.contentHash || cur.modifiedAt !== prep.modifiedAt || cur.sizeBytes !== prep.sizeBytes) {
          return { ok: false, code: 'conflict', error: '确认前文件状态已变化' };
        }
        if (cur.relativePath !== prep.relativePath) {
          return { ok: false, code: 'conflict', error: '文件路径已变化' };
        }
      }
    }
    return { ok: true };
  }

  function restoreInstanceFromUpdateSnapshot(op, instanceId) {
    const sim = getState().installSim || {};
    if (sim.updateRollbackFailInstanceId && sim.updateRollbackFailInstanceId === instanceId) {
      return { ok: false, code: 'rollback_failed' };
    }
    const snapId = (op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[instanceId]) || null;
    const snap = snapId
      ? getState().snapshots.find(s => s.id === snapId)
      : getState().snapshots.find(s => op.snapshotIds.includes(s.id) && s.instanceId === instanceId);
    if (!snap) return { ok: false, code: 'snapshot_missing' };
    const prepGroup = (op.preparedFileStates || []).find(g => g.instanceId === instanceId);
    const inst = getInstanceRaw(instanceId);
    const fileResults = [];
    (snap.files || []).forEach(sf => {
      const file = getFilesRawInternal({ instanceId }).find(f => f.relativePath === sf.relativePath);
      if (!file) {
        fileResults.push({ relativePath: sf.relativePath, status: 'rollback-failed' });
        return;
      }
      if (sf.content != null) file.content = String(sf.content);
      file.contentHash = sf.contentHash || (sf.content != null ? $hash(String(sf.content)) : file.contentHash);
      file.modifiedAt = sf.modifiedAt || file.modifiedAt;
      file.sizeBytes = sf.sizeBytes != null ? sf.sizeBytes : (file.content ? file.content.length : file.sizeBytes);
      if (sf.tokenCount != null) file.tokenCount = sf.tokenCount;
      if (sf.tokenCountMode != null) file.tokenCountMode = sf.tokenCountMode;
      fileResults.push({ relativePath: sf.relativePath, status: 'rolled-back' });
    });
    // restore instance package meta from prepared snapshot group if available
    if (inst && prepGroup) {
      const files = getFilesRawInternal({ instanceId });
      inst.fileCount = files.length;
      inst.packageSizeBytes = files.reduce((n, f) => n + (f.sizeBytes || 0), 0);
      inst.localModificationStatus = 'clean';
      inst.contentHash = (files.find(f => f.relativePath === 'SKILL.md') || {}).contentHash || inst.contentHash;
    }
    const failed = fileResults.some(r => r.status === 'rollback-failed');
    return { ok: !failed, files: fileResults };
  }

  function confirmUpdate(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const op = getState().updateOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    // Allow overriding strategies at confirm time without creating new prepare
    if (options.fileStrategies) Object.assign(op.fileStrategies || (op.fileStrategies = {}), options.fileStrategies);
    if (options.remoteAdds) op.remoteAdds = $coerceArray(options.remoteAdds);
    if (options.remoteDeletes) op.remoteDeletes = $coerceArray(options.remoteDeletes);

    const recheck = recheckUpdatePrepared(op);
    if (!recheck.ok) {
      op.status = recheck.code === 'permission-denied' ? 'failed' : 'conflict';
      saveState();
      return { ok: false, code: recheck.code, error: recheck.error, operationId, status: op.status };
    }

    op.confirmedAt = $now();
    const sim = getState().installSim || {};
    const results = [];
    const writtenInstanceIds = [];
    let failOccurred = false;
    let failMessage = null;

    for (const t of op.targets) {
      if (failOccurred) break;
      const targetResults = [];
      const strategies = op.fileStrategies || {};

      if (sim.updateFailInstanceId && sim.updateFailInstanceId === t.instanceId) {
        failOccurred = true;
        failMessage = 'sim_fail_instance';
        results.push({ instanceId: t.instanceId, files: [{ relativePath: '*', status: 'failed', errorCode: 'sim_fail' }], status: 'failed' });
        break;
      }

      // remote deletes
      $coerceArray(op.remoteDeletes).forEach(rel => {
        const strategy = strategies[rel] || 'use-remote';
        if (strategy === 'keep-local' || strategy === 'defer') {
          targetResults.push({ relativePath: rel, status: 'skipped', strategy });
          return;
        }
        if (strategy === 'manual-merge') {
          targetResults.push({ relativePath: rel, status: 'deferred-manual', strategy });
          return;
        }
        getState().files = getState().files.filter(f => !(f.instanceId === t.instanceId && f.relativePath === rel));
        targetResults.push({ relativePath: rel, status: 'deleted', strategy });
      });

      // remote adds
      $coerceArray(op.remoteAdds).forEach(add => {
        const rel = typeof add === 'string' ? add : add.relativePath;
        const strategy = strategies[rel] || 'use-remote';
        if (strategy === 'keep-local' || strategy === 'defer') {
          targetResults.push({ relativePath: rel, status: 'skipped', strategy });
          return;
        }
        if (strategy === 'manual-merge') {
          targetResults.push({ relativePath: rel, status: 'deferred-manual', strategy });
          return;
        }
        const content = (typeof add === 'object' && add.content != null)
          ? String(add.content)
          : (op._remoteContents && op._remoteContents[rel]) || '';
        const now = $now();
        getState().files.push(normalizeFile({
          id: uuid(), instanceId: t.instanceId, skillId: op.source.assetId,
          relativePath: rel, fileType: 'text', mimeType: 'text/markdown',
          sizeBytes: content.length, content, contentHash: $hash(content),
          modifiedAt: now, tokenCount: $tokenApprox(content), tokenCountMode: 'estimated',
          indexStatus: 'indexed'
        }));
        targetResults.push({ relativePath: rel, status: 'added', strategy });
      });

      const pathsToWrite = $coerceArray(op.selectedRelativePaths);
      for (const rel of pathsToWrite) {
        const strategy = strategies[rel] || 'use-remote';
        if (strategy === 'keep-local' || strategy === 'defer') {
          targetResults.push({ relativePath: rel, status: 'skipped', strategy });
          continue;
        }
        if (strategy === 'manual-merge') {
          const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
          const remote = op._remoteContents ? op._remoteContents[rel] : null;
          if (file && remote != null) {
            getState().drafts.push(normalizeDraft({
              id: uuid(),
              skillId: op.source.assetId,
              instanceId: t.instanceId,
              fileId: file.id,
              relativePath: rel,
              content: String(remote),
              createdAt: $now(),
              updatedAt: $now(),
              baseContentHash: file.contentHash,
              baseFileModifiedAt: file.modifiedAt,
              status: 'update-manual-merge'
            }));
          }
          targetResults.push({ relativePath: rel, status: 'manual-merge', strategy });
          continue;
        }
        // use-remote
        const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
        if (!file) {
          targetResults.push({ relativePath: rel, status: 'skipped' });
          continue;
        }
        if (sim.updateFailRelativePath && rel === sim.updateFailRelativePath) {
          targetResults.push({ relativePath: rel, status: 'failed', errorCode: 'write_failed' });
          failOccurred = true;
          failMessage = 'write_failed';
          break;
        }
        if (file.fileType === 'binary') {
          targetResults.push({ relativePath: rel, status: 'skipped', message: 'binary meta-only' });
          continue;
        }
        const remote = op._remoteContents[rel];
        if (remote == null) {
          targetResults.push({ relativePath: rel, status: 'skipped' });
          continue;
        }
        file.content = String(remote);
        file.contentHash = $hash(file.content);
        file.modifiedAt = $now();
        file.sizeBytes = file.content.length;
        file.tokenCount = $tokenApprox(file.content);
        file.tokenCountMode = 'estimated';
        targetResults.push({ relativePath: rel, status: 'completed', strategy });
      }

      // update instance package meta after writes
      const inst = getInstanceRaw(t.instanceId);
      if (inst) {
        const files = getFilesRawInternal({ instanceId: t.instanceId });
        inst.fileCount = files.length;
        inst.packageSizeBytes = files.reduce((n, f) => n + (f.sizeBytes || 0), 0);
        inst.contentHash = (files.find(f => f.relativePath === 'SKILL.md') || {}).contentHash || inst.contentHash;
      }

      writtenInstanceIds.push(t.instanceId);
      results.push({
        instanceId: t.instanceId,
        files: targetResults,
        status: targetResults.some(x => x.status === 'failed') ? 'failed' : 'completed'
      });
      if (failOccurred) break;
    }

    if (failOccurred) {
      // ATOMIC: rollback ALL previously written instances (including current if partially written)
      let rollbackFailed = false;
      writtenInstanceIds.forEach(iid => {
        const rb = restoreInstanceFromUpdateSnapshot(op, iid);
        const entry = results.find(r => r.instanceId === iid);
        if (!rb.ok) {
          rollbackFailed = true;
          if (entry) {
            entry.status = 'rollback-failed';
            entry.rollbackStatus = 'rollback-failed';
            entry.files = (entry.files || []).map(f =>
              f.status === 'completed' || f.status === 'added' || f.status === 'deleted'
                ? Object.assign({}, f, { status: 'rollback-failed', rollbackStatus: 'rollback-failed' })
                : f
            );
          }
        } else if (entry) {
          entry.status = 'rolled-back';
          entry.rollbackStatus = 'rolled-back';
          entry.files = (entry.files || []).map(f =>
            f.status === 'completed' || f.status === 'added' || f.status === 'deleted'
              ? Object.assign({}, f, { status: 'rolled-back', rollbackStatus: 'rolled-back' })
              : f
          );
        }
      });
      op.results = results;
      op.status = rollbackFailed ? 'rollback-failed' : (writtenInstanceIds.length ? 'rolled-back' : 'failed');
      op.completedAt = $now();
      addAuditEvent({
        skillId: op.source.assetId, eventType: 'update_failed', category: 'update',
        source: 'Skill Panel', result: 'failed', snapshotId: op.snapshotIds[0],
        note: '更新失败并' + (rollbackFailed ? '回滚失败' : (writtenInstanceIds.length ? '回滚' : '中止')) + (failMessage ? (' · ' + failMessage) : '')
      });
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false,
        status: op.status,
        operationId,
        results,
        snapshotIds: op.snapshotIds
      }));
    }

    // ALL succeed — only then update SourceBinding baseline
    const binding = getState().sourceBindings.find(b => b.id === op.source.bindingId);
    if (binding) {
      binding.baselineVersion = op.remoteVersion;
      binding.baselineCommit = op.remoteCommit;
      binding.remoteVersion = op.remoteVersion;
      binding.remoteCommit = op.remoteCommit;
      binding.updateStatus = 'up-to-date';
      binding.lastCheckedAt = $now();
      const first = op.targets[0];
      if (first) {
        const snap = createPackageSnapshotForInstance(first.instanceId, {
          note: '更新后 Baseline Snapshot', source: 'update-baseline', retained: true
        });
        if (snap) {
          getState().snapshots.push(snap);
          binding.baselineSnapshotId = snap.id;
          op.snapshotIds.push(snap.id);
        }
      }
      addAuditEvent({
        skillId: op.source.assetId, eventType: 'update_completed', category: 'update',
        source: 'Skill Panel', result: 'completed', snapshotId: binding.baselineSnapshotId,
        note: '更新完成 · ' + op.remoteVersion
      });
    }

    op.results = results;
    op.status = 'completed';
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      status: op.status,
      operationId,
      results,
      snapshotIds: op.snapshotIds
    }));
  }

  function getUpdateOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().updateOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function loadUpdateDemoCase(caseId) {
    ensurePhaseFCollections();
    const sim = getState().installSim;
    sim.forceUpdateAvailable = false;
    sim.remoteVersion = null;
    sim.updateFailRelativePath = null;
    sim.updateFailInstanceId = null;
    sim.updateRollbackFailInstanceId = null;
    if (caseId === 'update-available') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.9';
    } else if (caseId === 'update-partial-fail') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.8';
      sim.updateFailRelativePath = 'references/checklist.md';
    } else if (caseId === 'clear') {
      /* noop */
    } else return { ok: false, error: 'Unknown case' };
    saveState();
    return { ok: true, caseId };
  }

  function openUpdatePage(assetId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const rid = resolveAssetId(assetId) || assetId;
    const q = new URLSearchParams();
    if (rid) q.set('skill', rid);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'update.html?' + q.toString();
  }

  /* ----- Uninstall ----- */
  function prepareUninstall(options = {}) {
    ensurePhaseFCollections();
    const assetId = resolveAssetId(options.assetId) || options.assetId;
    if (!assetId) return { ok: false, code: 'not_found' };
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, code: 'not_found' };
    const mode = options.mode || 'stop-managing'; // stop-managing | remove-from-host | delete-local-copy | detach-source
    const deleteFiles = !!options.deleteFiles;
    const requiresSecondConfirm = mode === 'delete-local-copy' || deleteFiles === true;

    let targets = [];
    if (mode === 'detach-source') {
      targets = [];
    } else {
      const instanceIds = $coerceArray(options.instanceIds);
      const all = getState().instances.filter(i => i.skillId === assetId);
      targets = (instanceIds.length ? all.filter(i => instanceIds.includes(i.id)) : all).map(i => ({
        instanceId: i.id,
        hostType: i.hostType,
        path: i.skillFilePath,
        fileCount: getFilesRawInternal({ instanceId: i.id }).length,
        packageHash: packageHashForInstance(i.id),
        lifecycleStatus: i.lifecycleStatus,
        isPrimary: !!i.isPrimary,
        sourceBindingId: i.sourceBindingId || null
      }));
      if (!targets.length) return { ok: false, code: 'no_target' };
    }

    const snapIds = [];
    const snapshotIdByInstanceId = {};
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '卸载前 Package Snapshot', source: 'pre-uninstall', retained: true
      });
      if (snap) {
        getState().snapshots.push(snap);
        snapIds.push(snap.id);
        snapshotIdByInstanceId[t.instanceId] = snap.id;
      }
    });

    const preparedAt = $now();
    const assetBinding = asset.sourceBindingId
      ? getState().sourceBindings.find(b => b.id === asset.sourceBindingId)
      : getState().sourceBindings.find(b => b.skillId === assetId && (!b.scope || b.scope === 'asset'));

    const op = {
      id: uuid(),
      type: 'uninstall',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId },
      mode,
      deleteFiles,
      detachSource: mode === 'detach-source' || !!options.detachSource,
      targets,
      snapshotIds: snapIds,
      snapshotIdByInstanceId,
      preparedAssetState: {
        lifecycleStatus: asset.lifecycleStatus,
        primaryInstanceId: asset.primaryInstanceId || null,
        sourceBindingId: asset.sourceBindingId || null
      },
      preparedBindingIds: getState().sourceBindings.filter(b => b.skillId === assetId).map(b => b.id),
      confirmationHash: $hash(JSON.stringify({ assetId, mode, targets: targets.map(t => t.instanceId), deleteFiles })),
      impact: {
        assetId,
        instanceCount: targets.length,
        remainingInstances: getState().instances.filter(i => i.skillId === assetId).length - targets.length,
        draftCount: getState().drafts.filter(d => d.skillId === assetId).length,
        hasSourceBinding: !!assetBinding,
        mode
      },
      requiresSecondConfirm,
      results: [],
      confirmedAt: null,
      completedAt: null,
      _checkpoint: {
        asset: JSON.parse(JSON.stringify(asset)),
        instances: {},
        files: [],
        bindings: [],
        primaryByInstance: {}
      }
    };
    targets.forEach(t => {
      const inst = getInstanceRaw(t.instanceId);
      if (inst) op._checkpoint.instances[t.instanceId] = JSON.parse(JSON.stringify(inst));
      op._checkpoint.files.push(...getFilesRawInternal({ instanceId: t.instanceId }).map(f => JSON.parse(JSON.stringify(f))));
    });
    op._checkpoint.bindings = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => JSON.parse(JSON.stringify(b)));

    getState().uninstallOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      mode,
      targets,
      impact: op.impact,
      snapshotIds: snapIds,
      requiresSecondConfirm,
      simulated: true,
      note: '原型不会真实删除宿主文件系统文件'
    }));
  }

  function recheckUninstallPrepared(op) {
    const assetId = op.source.assetId;
    const asset = getAssetRaw(assetId);
    if (!asset) return { ok: false, code: 'operation_invalid', error: 'Asset 不存在' };
    const prepA = op.preparedAssetState || {};
    if (prepA.lifecycleStatus && asset.lifecycleStatus !== prepA.lifecycleStatus) {
      return { ok: false, code: 'operation_invalid', error: 'Asset 生命周期已变化' };
    }
    if ((prepA.primaryInstanceId || null) !== (asset.primaryInstanceId || null)) {
      return { ok: false, code: 'operation_invalid', error: '主 Instance 已变化' };
    }
    if ((prepA.sourceBindingId || null) !== (asset.sourceBindingId || null)) {
      return { ok: false, code: 'operation_invalid', error: 'SourceBinding 已变化' };
    }
    const curBindingIds = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => b.id).slice().sort().join('|');
    const prepBindingIds = $coerceArray(op.preparedBindingIds).slice().sort().join('|');
    if (curBindingIds !== prepBindingIds) {
      return { ok: false, code: 'operation_invalid', error: 'SourceBinding 集合已变化' };
    }
    for (const t of op.targets) {
      const inst = getInstanceRaw(t.instanceId);
      if (!inst || inst.skillId !== assetId) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 不属于该 Asset 或不存在' };
      }
      if (inst.lifecycleStatus !== t.lifecycleStatus) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 生命周期已变化' };
      }
      if (inst.skillFilePath !== t.path) {
        return { ok: false, code: 'operation_invalid', error: 'Instance 路径已变化' };
      }
      if (getFilesRawInternal({ instanceId: t.instanceId }).length !== t.fileCount) {
        return { ok: false, code: 'operation_invalid', error: '文件数量已变化' };
      }
      if (t.packageHash && packageHashForInstance(t.instanceId) !== t.packageHash) {
        return { ok: false, code: 'operation_invalid', error: 'Package Hash 已变化' };
      }
      const snapId = op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[t.instanceId];
      if (snapId) {
        const snap = getState().snapshots.find(s => s.id === snapId);
        if (!snap || snap.instanceId !== t.instanceId) {
          return { ok: false, code: 'operation_invalid', error: 'Snapshot 无效' };
        }
      }
    }
    return { ok: true };
  }

  function restoreUninstallCheckpoint(op) {
    const cp = op._checkpoint;
    if (!cp) return false;
    const assetId = op.source.assetId;
    if (cp.asset) {
      const asset = getAssetRaw(assetId);
      if (asset) {
        Object.keys(cp.asset).forEach(k => { asset[k] = cp.asset[k]; });
      }
    }
    Object.keys(cp.instances || {}).forEach(iid => {
      const snap = cp.instances[iid];
      let inst = getInstanceRaw(iid);
      if (!inst) {
        getState().instances.push(JSON.parse(JSON.stringify(snap)));
      } else {
        Object.keys(snap).forEach(k => { inst[k] = snap[k]; });
      }
    });
    // restore files: put back any missing
    (cp.files || []).forEach(f => {
      if (!getFileRawInternal(f.id)) getState().files.push(JSON.parse(JSON.stringify(f)));
    });
    // restore bindings
    (cp.bindings || []).forEach(b => {
      if (!getState().sourceBindings.find(x => x.id === b.id)) {
        getState().sourceBindings.push(JSON.parse(JSON.stringify(b)));
      }
    });
    return true;
  }

  function confirmUninstall(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const op = getState().uninstallOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    const requiresSecond = op.requiresSecondConfirm || op.mode === 'delete-local-copy' || !!op.deleteFiles;
    if (requiresSecond && !options.secondConfirmed) {
      return { ok: false, code: 'second_confirm_required', error: '删除本地副本需要二次确认' };
    }

    const recheck = recheckUninstallPrepared(op);
    if (!recheck.ok) {
      op.status = 'invalidated';
      saveState();
      return { ok: false, code: recheck.code, error: recheck.error, operationId };
    }

    op.confirmedAt = $now();
    const assetId = op.source.assetId;
    const results = [];
    const sim = getState().installSim || {};
    const appliedInstanceIds = [];
    let failOccurred = false;

    // Capture pre-apply checkpoint deltas for atomic rollback (refresh)
    op._checkpoint.asset = JSON.parse(JSON.stringify(getAssetRaw(assetId)));
    op.targets.forEach(t => {
      const inst = getInstanceRaw(t.instanceId);
      if (inst) op._checkpoint.instances[t.instanceId] = JSON.parse(JSON.stringify(inst));
    });
    op._checkpoint.files = [];
    op.targets.forEach(t => {
      op._checkpoint.files.push(...getFilesRawInternal({ instanceId: t.instanceId }).map(f => JSON.parse(JSON.stringify(f))));
    });
    op._checkpoint.bindings = getState().sourceBindings.filter(b => b.skillId === assetId).map(b => JSON.parse(JSON.stringify(b)));

    if (op.mode === 'detach-source' || (op.detachSource && !op.targets.length)) {
      // ONLY remove bindings — no instance/asset lifecycle, no file/draft delete
      getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== assetId);
      const asset = getAssetRaw(assetId);
      if (asset) asset.sourceBindingId = null;
      getState().instances.filter(i => i.skillId === assetId).forEach(i => { i.sourceBindingId = null; });
      results.push({ scope: 'source-binding', status: 'completed', message: '已解除 SourceBinding，未删除文件，未改变生命周期' });
      addAuditEvent({
        skillId: assetId, eventType: 'source_detached', category: 'uninstall',
        source: 'Skill Panel', result: 'completed', note: '解除来源绑定'
      });
      op.results = results;
      op.status = 'completed';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({
        ok: true, status: 'completed', operationId, results,
        assetStatus: asset ? asset.lifecycleStatus : null,
        note: 'detach-source：仅解除绑定'
      }));
    }

    for (const t of op.targets) {
      if (sim.uninstallFailInstanceId && sim.uninstallFailInstanceId === t.instanceId) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'sim_fail' });
        failOccurred = true;
        break;
      }
      const inst = getInstanceRaw(t.instanceId);
      if (!inst) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'missing' });
        failOccurred = true;
        break;
      }

      const snapId = (op.snapshotIdByInstanceId && op.snapshotIdByInstanceId[t.instanceId]) || op.snapshotIds[0] || null;

      if (op.mode === 'stop-managing') {
        inst.lifecycleStatus = 'stopped';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: false,
          message: '已停止管理，未删除文件'
        });
      } else if (op.mode === 'remove-from-host') {
        inst.lifecycleStatus = 'removed-from-host-simulated';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: false,
          message: '已从宿主移除（模拟）· 真实宿主文件未被删除'
        });
      } else if (op.mode === 'delete-local-copy') {
        getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
        inst.lifecycleStatus = 'deleted';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId, status: 'completed', filesDeleted: true,
          message: '已删除 Formal Index 副本记录（模拟）'
        });
      } else {
        // fallback treat as stop-managing
        inst.lifecycleStatus = 'stopped';
        inst.isPrimary = false;
        results.push({ instanceId: t.instanceId, status: 'completed', filesDeleted: false });
      }

      if (op.deleteFiles && op.mode !== 'delete-local-copy') {
        getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
        results[results.length - 1].filesDeleted = true;
        results[results.length - 1].message = '已从 Formal Index 移除文件记录（非真实磁盘删除）';
      }

      addAuditEvent({
        skillId: assetId, instanceId: t.instanceId,
        eventType: 'uninstall_instance', category: 'uninstall', source: 'Skill Panel', result: 'completed',
        snapshotId: snapId,
        note: op.mode + ' · ' + (t.path || '')
      });
      appliedInstanceIds.push(t.instanceId);
    }

    if (failOccurred) {
      restoreUninstallCheckpoint(op);
      results.forEach(r => {
        if (r.status === 'completed' && appliedInstanceIds.includes(r.instanceId)) {
          r.status = 'rolled-back';
          r.rollbackStatus = 'rolled-back';
        }
      });
      op.results = results;
      op.status = 'rolled-back';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({
        ok: false, status: 'rolled-back', operationId, results,
        note: '卸载部分失败，已原子回滚'
      }));
    }

    // Asset lifecycle if last active instance gone
    const remaining = getState().instances.filter(i =>
      i.skillId === assetId &&
      i.lifecycleStatus !== 'stopped' &&
      i.lifecycleStatus !== 'deleted' &&
      i.lifecycleStatus !== 'missing' &&
      i.lifecycleStatus !== 'removed-from-host-simulated'
    );
    const asset = getAssetRaw(assetId);
    if (asset && remaining.length === 0 && op.targets.length) {
      asset.lifecycleStatus = 'archived';
      asset.updatedAt = $now();
      asset.primaryInstanceId = null;
    } else if (asset && remaining.length) {
      if (!remaining.some(i => i.isPrimary)) remaining[0].isPrimary = true;
      asset.primaryInstanceId = remaining.find(i => i.isPrimary).id;
    }

    op.results = results;
    op.status = 'completed';
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      status: op.status,
      operationId,
      results,
      assetStatus: asset ? asset.lifecycleStatus : null,
      note: '原型不声称完成真实文件系统删除'
    }));
  }

  function getUninstallOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().uninstallOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

  function openUninstallPage(assetId, context = {}) {
    saveOrigin({ originPage: location.pathname.split('/').pop(), ...context });
    const rid = resolveAssetId(assetId) || assetId;
    const q = new URLSearchParams();
    if (rid) q.set('skill', rid);
    if (isTestMode()) q.set('dev', '1');
    location.href = 'uninstall.html?' + q.toString();
  }

  /* ----- Duplicate Resolution Operation (Compare destructive) ----- */
  function buildDuplicateImpactPreview(action, candidateIds, primaryAssetId, archiveAssetId) {
    const candidates = candidateIds.map(id => getAssetRaw(id)).filter(Boolean);
    const primary = primaryAssetId ? getAssetRaw(primaryAssetId) : null;
    const mergedAway = action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance'
      ? candidateIds.filter(id => id !== primaryAssetId)
      : (action === 'merge-new' || action === 'merge_new' ? candidateIds.slice() : []);
    const movedInstances = [];
    mergedAway.forEach(oid => {
      getState().instances.filter(i => i.skillId === oid).forEach(i => movedInstances.push(i.id));
    });
    if (action === 'merge-new' || action === 'merge_new') {
      // all instances move
    }
    const draftCount = candidateIds.reduce((n, id) => n + getState().drafts.filter(d => d.skillId === id).length, 0);
    const snapshotCount = candidateIds.reduce((n, id) => n + getState().snapshots.filter(s => s.skillId === id).length, 0);
    const pendingTaskCount = candidateIds.reduce((n, id) => n + getState().pendingTasks.filter(t => t.skillId === id && t.status === 'open').length, 0);
    const editorSessions = (getState().editorSessions || []).filter(s => candidateIds.includes(s.assetId) || candidateIds.includes(s.skillId)).map(s => s.id);
    const conflicts = (getState().conflicts || []).filter(c => candidateIds.includes(c.assetId) || candidateIds.includes(c.skillId)).map(c => c.id);
    const categoryDiff = {};
    const tagDiff = {};
    const favoriteDiff = {};
    candidates.forEach(a => {
      categoryDiff[a.id] = $coerceArray(a.categoryIds);
      tagDiff[a.id] = $coerceArray(a.tagIds);
      favoriteDiff[a.id] = !!a.isFavorite;
    });
    const bindings = getState().sourceBindings.filter(b => candidateIds.includes(b.skillId));
    return {
      preservedAssetId: (action === 'merge-new' || action === 'merge_new') ? null : (primaryAssetId || null),
      newAssetWillBeCreated: action === 'merge-new' || action === 'merge_new',
      mergedAwayAssets: mergedAway,
      movedInstances,
      sourceBindingImpact: bindings.map(b => ({ id: b.id, skillId: b.skillId, sourceType: b.sourceType, scope: b.scope || 'asset' })),
      draftCount,
      snapshotCount,
      pendingTaskCount,
      editorSessions,
      conflicts,
      categoryDiff,
      tagDiff,
      favoriteDiff,
      archiveAssetId: archiveAssetId || null
    };
  }

  function captureDuplicateEntityCheckpoint(candidateIds) {
    const state = getState();
    const ids = new Set(candidateIds);
    return {
      assets: state.assets.filter(a => ids.has(a.id)).map(a => JSON.parse(JSON.stringify(a))),
      instances: state.instances.filter(i => ids.has(i.skillId)).map(i => JSON.parse(JSON.stringify(i))),
      files: state.files.filter(f => ids.has(f.skillId)).map(f => JSON.parse(JSON.stringify(f))),
      bindings: state.sourceBindings.filter(b => ids.has(b.skillId)).map(b => JSON.parse(JSON.stringify(b))),
      drafts: state.drafts.filter(d => ids.has(d.skillId)).map(d => JSON.parse(JSON.stringify(d))),
      snapshots: state.snapshots.filter(s => ids.has(s.skillId)).map(s => ({
        id: s.id, skillId: s.skillId, instanceId: s.instanceId, type: s.type, note: s.note, source: s.source, retained: s.retained
      })),
      pendingTasks: state.pendingTasks.filter(t => ids.has(t.skillId)).map(t => JSON.parse(JSON.stringify(t))),
      permissionGrants: (state.permissionGrants || []).filter(g =>
        (g.scopeType === 'asset' && ids.has(g.scopeId)) ||
        (g.scopeType === 'instance' && state.instances.some(i => i.id === g.scopeId && ids.has(i.skillId)))
      ).map(g => JSON.parse(JSON.stringify(g))),
      editorSessions: (state.editorSessions || []).filter(s => ids.has(s.assetId) || ids.has(s.skillId)).map(s => JSON.parse(JSON.stringify(s))),
      conflicts: (state.conflicts || []).filter(c => ids.has(c.assetId) || ids.has(c.skillId)).map(c => JSON.parse(JSON.stringify(c))),
      assetIds: candidateIds.slice()
    };
  }

  function restoreDuplicateEntityCheckpoint(cp) {
    if (!cp) return false;
    const state = getState();
    const idSet = new Set(cp.assetIds || []);
    const knownAssetIds = new Set((cp.assets || []).map(a => a.id));
    const knownInstanceIds = new Set((cp.instances || []).map(i => i.id));
    const knownFileIds = new Set((cp.files || []).map(f => f.id));
    const knownBindingIds = new Set((cp.bindings || []).map(b => b.id));
    const knownDraftIds = new Set((cp.drafts || []).map(d => d.id));

    // Drop entities tied to candidate assets, plus any newly created merge assets
    state.assets = state.assets.filter(a => knownAssetIds.has(a.id) || !idSet.has(a.id));
    state.assets = state.assets.filter(a => knownAssetIds.has(a.id) || !String(a.displayName || '').includes('(合并)'));
    state.instances = state.instances.filter(i => knownInstanceIds.has(i.id) || !idSet.has(i.skillId));
    state.files = state.files.filter(f => knownFileIds.has(f.id) || !idSet.has(f.skillId));
    state.sourceBindings = state.sourceBindings.filter(b => knownBindingIds.has(b.id) || !idSet.has(b.skillId));
    state.drafts = state.drafts.filter(d => knownDraftIds.has(d.id) || !idSet.has(d.skillId));

    (cp.snapshots || []).forEach(ref => {
      const s = state.snapshots.find(x => x.id === ref.id);
      if (s) {
        s.skillId = ref.skillId;
        s.instanceId = ref.instanceId;
      }
    });

    function upsert(list, item, key) {
      const cur = list.find(x => x[key] === item[key]);
      if (!cur) list.push(JSON.parse(JSON.stringify(item)));
      else Object.keys(item).forEach(k => { cur[k] = item[k]; });
    }
    (cp.assets || []).forEach(a => upsert(state.assets, a, 'id'));
    (cp.instances || []).forEach(i => upsert(state.instances, i, 'id'));
    (cp.files || []).forEach(f => upsert(state.files, f, 'id'));
    (cp.bindings || []).forEach(b => upsert(state.sourceBindings, b, 'id'));
    (cp.drafts || []).forEach(d => upsert(state.drafts, d, 'id'));
    (cp.pendingTasks || []).forEach(t => upsert(state.pendingTasks, t, 'id'));
    (cp.permissionGrants || []).forEach(g => upsert(state.permissionGrants || (state.permissionGrants = []), g, 'id'));
    (cp.editorSessions || []).forEach(s => upsert(state.editorSessions || (state.editorSessions = []), s, 'id'));
    (cp.conflicts || []).forEach(c => upsert(state.conflicts || (state.conflicts = []), c, 'id'));
    return true;
  }

  function prepareDuplicateResolution(options = {}) {
    ensurePhaseFCollections();
    ensureCompareCollections();
    const action = options.action || options.resolution;
    if (!action) return { ok: false, error: 'Missing action' };
    const destructive = (
      action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance' ||
      action === 'merge-new' || action === 'merge_new' ||
      action === 'archive'
    );
    if (!destructive) {
      return { ok: false, code: 'not_destructive', error: '非破坏性动作请直接使用 resolveDuplicateComparison' };
    }

    const session = options.sessionId
      ? getState().compareSessions.find(s => s.id === options.sessionId)
      : null;
    const candidateIds = session
      ? $coerceArray(session.candidateIds).slice()
      : $coerceArray(options.candidateIds).map(id => resolveAssetId(id) || id).filter(Boolean);
    if (!candidateIds.length) return { ok: false, code: 'no_candidates' };
    const groupId = options.groupId || (session && session.groupId) || null;
    const primaryAssetId = resolveAssetId(options.primaryAssetId) || options.primaryAssetId || candidateIds[0];
    const archiveAssetId = resolveAssetId(options.archiveAssetId) || options.archiveAssetId || null;
    const archiveInstanceId = options.archiveInstanceId || null;

    const impact = buildDuplicateImpactPreview(action, candidateIds, primaryAssetId, archiveAssetId);
    const preparedAt = $now();
    const op = {
      id: uuid(),
      type: 'duplicate-resolution',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      action,
      sessionId: session ? session.id : (options.sessionId || null),
      groupId,
      candidateIds,
      primaryAssetId,
      archiveAssetId,
      archiveInstanceId,
      options: {
        name: options.name || null,
        displayName: options.displayName || null,
        reason: options.reason || null
      },
      impact,
      checkpointId: uuid(),
      _entityCheckpoint: captureDuplicateEntityCheckpoint(candidateIds),
      confirmationHash: $hash(JSON.stringify({ action, candidateIds, primaryAssetId, archiveAssetId })),
      results: null,
      confirmedAt: null,
      completedAt: null
    };
    getState().duplicateResolutionOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      action,
      impact,
      candidateIds,
      primaryAssetId,
      archiveAssetId,
      requiresConfirm: true
    }));
  }

  function confirmDuplicateResolution(operationId, options = {}) {
    ensurePhaseFCollections();
    if (!options.userConfirmed) return { ok: false, code: 'not_confirmed' };
    const op = getState().duplicateResolutionOperations.find(o => o.id === operationId);
    if (!op) return { ok: false, code: 'operation_not_found' };
    if (op.status !== 'prepared') return { ok: false, code: 'operation_invalid', status: op.status };
    if (Date.parse(op.expiresAt) < Date.now()) {
      op.status = 'expired'; saveState();
      return { ok: false, code: 'operation_expired' };
    }

    op.confirmedAt = $now();
    op.status = 'applying';
    const action = op.action;
    const candidateIds = op.candidateIds.slice();
    const groupId = op.groupId;
    let result = { ok: true, action };

    try {
      if (action === 'confirm-multi-instance' || action === 'confirm_same_asset' || action === 'multi-instance') {
        const primaryAssetId = op.primaryAssetId || candidateIds[0];
        const others = candidateIds.filter(id => id !== primaryAssetId);
        const merge = mergeCandidatesAsMultiInstance(primaryAssetId, others);
        if (!merge.ok) throw new Error(merge.error || 'merge failed');
        const resolved = resolveDuplicateTasksForCandidates(candidateIds, groupId);
        addAuditEvent({
          skillId: primaryAssetId,
          eventType: 'compare_confirm_multi_instance',
          category: 'system',
          source: 'Skill Panel',
          result: 'completed',
          note: '确认为同一 Asset 多实例 · 保留 UUID ' + primaryAssetId + ' · 并入实例 ' + merge.movedInstanceIds.length
        });
        result = { ...result, ...merge, preservedAssetId: merge.preservedAssetId, resolvedTaskCount: resolved };
      } else if (action === 'archive') {
        const archiveAssetId = op.archiveAssetId;
        const archiveInstanceId = op.archiveInstanceId;
        if (archiveInstanceId) {
          const inst = getInstanceRaw(archiveInstanceId);
          if (!inst) throw new Error('Instance not found');
          const siblings = getState().instances.filter(i => i.skillId === inst.skillId);
          if (siblings.length <= 1) {
            archiveSkill(inst.skillId, (op.options && op.options.reason) || 'Compare 归档');
            result.archivedAssetId = inst.skillId;
          } else {
            const det = detachInstance(archiveInstanceId);
            result.detachedInstanceId = archiveInstanceId;
            result.detach = det;
          }
        } else if (archiveAssetId) {
          archiveSkill(archiveAssetId, (op.options && op.options.reason) || 'Compare 归档');
          result.archivedAssetId = archiveAssetId;
        } else {
          throw new Error('archiveAssetId or archiveInstanceId required');
        }
        result.resolvedTaskCount = resolveDuplicateTasksForCandidates(candidateIds, groupId);
        addAuditEvent({
          skillId: result.archivedAssetId || null,
          instanceId: archiveInstanceId || null,
          eventType: 'compare_archive',
          category: 'archive',
          source: 'Skill Panel',
          result: 'completed',
          note: 'Compare 归档候选'
        });
      } else if (action === 'merge-new' || action === 'merge_new') {
        const merged = createMergedAssetFromCandidates(candidateIds, op.options || {});
        if (!merged.ok) throw new Error(merged.error || 'merge-new failed');
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
        throw new Error('Unknown action: ' + action);
      }

      // Ensure no active instances point at deleted candidate assets
      candidateIds.forEach(cid => {
        const a = getAssetRaw(cid);
        if (a && a.lifecycleStatus === 'deleted') {
          const dangling = getState().instances.filter(i => i.skillId === cid && i.lifecycleStatus === 'available');
          if (dangling.length) throw new Error('Active instance points at deleted asset: ' + dangling[0].id);
        }
      });

      if (op.sessionId) {
        const session = getState().compareSessions.find(s => s.id === op.sessionId);
        if (session) {
          session.status = 'resolved';
          session.resolvedAt = $now();
          session.resolution = {
            action,
            at: session.resolvedAt,
            primaryAssetId: result.preservedAssetId || result.newAssetId || op.primaryAssetId || null,
            archivedAssetId: result.archivedAssetId || null,
            operationId: op.id
          };
        }
      }

      op.results = result;
      op.status = 'completed';
      op.completedAt = $now();
      saveState();
      return JSON.parse(JSON.stringify({ ok: true, status: 'completed', operationId, ...result }));
    } catch (e) {
      restoreDuplicateEntityCheckpoint(op._entityCheckpoint);
      op.status = 'failed';
      op.completedAt = $now();
      op.results = { ok: false, error: String(e.message || e) };
      saveState();
      return JSON.parse(JSON.stringify({ ok: false, status: 'failed', operationId, error: String(e.message || e) }));
    }
  }

  function getDuplicateResolutionOperation(operationId) {
    ensurePhaseFCollections();
    const op = getState().duplicateResolutionOperations.find(o => o.id === operationId);
    return op ? toSafeOperationView(op) : null;
  }

