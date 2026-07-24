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
    if (!state.installSim) state.installSim = { failTargetHost: null, updateFailRelativePath: null };
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
      // try match by skill name fragment
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
    const state = getState();
    const host = state.hosts.find(h => h.id === hostId) || state.hosts[0];
    const sameName = state.assets.filter(a => a.name === resolved.skillName && a.lifecycleStatus !== 'deleted');
    const targetPath = (host.path || '~/.skills') + '/' + resolved.skillName + '/SKILL.md';
    const pathClash = state.instances.find(i => i.skillFilePath === targetPath && i.lifecycleStatus === 'available');
    const issues = [];
    if (sameName.length) issues.push({ code: 'same_name_asset', severity: 'medium', assetIds: sameName.map(a => a.id), message: '存在同名 Asset' });
    if (pathClash) issues.push({ code: 'path_conflict', severity: 'high', instanceId: pathClash.id, message: '目标路径已有 Instance' });
    const perm = host.permissionStatus === 'granted';
    if (!perm) issues.push({ code: 'permission-denied', severity: 'high', message: '目标 Host 无权限' });
    return { host, targetPath, issues, sameNameAssets: sameName.map(a => ({ id: a.id, name: a.name })) };
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
    if (mode === 'add-instance' && !existingAssetId) {
      return { ok: false, code: 'asset_required', error: '作为现有 Asset 的新 Instance 需要 existingAssetId' };
    }
    const targets = [];
    const allIssues = [];
    hostIds.forEach(hid => {
      const analysis = analyzeInstallConflicts(resolved, hid);
      allIssues.push(...analysis.issues.map(i => Object.assign({ hostId: hid }, i)));
      targets.push({
        hostId: hid,
        hostName: analysis.host ? analysis.host.name : hid,
        targetPath: analysis.targetPath,
        permissionOk: !(analysis.issues || []).some(i => i.code === 'permission-denied'),
        pathConflict: (analysis.issues || []).some(i => i.code === 'path_conflict')
      });
    });
    if (allIssues.some(i => i.code === 'path_conflict') && mode === 'new-asset') {
      return { ok: false, code: 'path_conflict', error: '同路径冲突被阻止', issues: allIssues, resolved, targets };
    }
    if (allIssues.some(i => i.code === 'permission-denied')) {
      return { ok: false, code: 'permission-denied', error: '目标权限不足', issues: allIssues, resolved, targets };
    }
    const preparedAt = $now();
    const catalog = INSTALL_CATALOG[resolved.catalogKey];
    const confirmationHash = $hash(JSON.stringify({
      catalogKey: resolved.catalogKey, mode, existingAssetId, targets: targets.map(t => t.targetPath)
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
        trustPolicy: resolved.trustPolicy
      },
      mode,
      existingAssetId,
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
    // Checkpoint snapshot of current formal index sizes (metadata)
    op.checkpointId = uuid();
    op._checkpoint = {
      id: op.checkpointId,
      assetCount: getState().assets.length,
      instanceCount: getState().instances.length,
      fileCount: getState().files.length
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
      risks: resolved.risks,
      confirmationHash,
      simulated: true
    }));
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
    // Re-check targets
    for (const t of op.targets) {
      if (getState().instances.some(i => i.skillFilePath === t.targetPath && i.lifecycleStatus === 'available')) {
        op.status = 'failed';
        saveState();
        return { ok: false, code: 'path_conflict', error: '确认前再次检查发现路径冲突', operationId };
      }
    }
    op.confirmedAt = $now();
    op.status = 'installing';
    const catalog = INSTALL_CATALOG[op.source.catalogKey];
    const results = [];
    const createdAssetIds = [];
    const sim = getState().installSim || {};
    let anyOk = false;
    let anyFail = false;

    op.targets.forEach(t => {
      if (sim.failTargetHost && sim.failTargetHost === t.hostId) {
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'failed', errorCode: 'sim_fail', message: '模拟安装失败' });
        anyFail = true;
        return;
      }
      try {
        const now = $now();
        let assetId = op.existingAssetId;
        if (op.mode === 'new-asset' || !assetId) {
          assetId = uuid(); // permanent UUID
          getState().assets.push(normalizeAsset({
            id: assetId,
            name: op.source.skillName,
            displayName: catalog.displayName || op.source.skillName,
            description: 'Installed via simulated source',
            categoryIds: [], tagIds: [],
            lifecycleStatus: 'available',
            primaryInstanceId: null,
            supportedHosts: [t.hostId],
            createdAt: now, updatedAt: now
          }));
          createdAssetIds.push(assetId);
        }
        const instanceId = uuid();
        const host = getState().hosts.find(h => h.id === t.hostId);
        const hostType = host ? host.hostType : 'claude-code';
        getState().instances.push(normalizeInstance({
          id: instanceId, skillId: assetId, hostType,
          rootPath: t.targetPath.replace(/\/SKILL\.md$/, ''),
          skillFilePath: t.targetPath,
          lifecycleStatus: 'available', permissionMode: 'managed',
          installedVersion: op.source.version || '0.1.0',
          healthStatuses: ['normal'], isPrimary: !getState().instances.some(i => i.skillId === assetId && i.isPrimary),
          lastSeenAt: now,
          contentHash: $hash((catalog.files.find(f => f.relativePath === 'SKILL.md') || {}).content || ''),
          fileCount: catalog.files.length,
          packageSizeBytes: catalog.files.reduce((n, f) => n + (f.content ? f.content.length : (f.sizeBytes || 0)), 0),
          localModificationStatus: 'clean'
        }));
        const asset = getAssetRaw(assetId);
        if (asset && !asset.primaryInstanceId) asset.primaryInstanceId = instanceId;

        catalog.files.forEach(f => {
          getState().files.push(normalizeFile({
            id: uuid(), instanceId, skillId: assetId,
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
        });

        const snap = createPackageSnapshotForInstance(instanceId, {
          note: '安装基线 Package Snapshot', source: 'install-baseline', retained: true
        });
        if (snap) {
          getState().snapshots.push(snap);
          op.snapshotIds.push(snap.id);
        }
        const binding = normalizeSourceBinding({
          id: uuid(),
          skillId: assetId,
          sourceType: op.source.sourceType,
          sourceUrl: op.source.sourceUrl,
          repository: op.source.repository,
          branch: op.source.branch,
          baselineVersion: op.source.version,
          baselineCommit: op.source.commit,
          baselineSnapshotId: snap ? snap.id : null,
          trustPolicy: op.source.trustPolicy,
          lastCheckedAt: now,
          updateStatus: 'up-to-date',
          remoteVersion: op.source.version,
          remoteCommit: op.source.commit
        });
        getState().sourceBindings.push(binding);
        if (asset) asset.sourceBindingId = binding.id;

        addAuditEvent({
          skillId: assetId, instanceId, eventType: 'install_completed', category: 'install',
          source: 'Skill Panel', result: 'completed', snapshotId: snap ? snap.id : null,
          note: '模拟安装 · ' + op.source.skillName + ' → ' + t.targetPath
        });
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'completed', assetId, instanceId, snapshotId: snap ? snap.id : null });
        anyOk = true;
      } catch (e) {
        results.push({ hostId: t.hostId, targetPath: t.targetPath, status: 'failed', errorCode: 'exception', message: String(e.message || e) });
        anyFail = true;
      }
    });

    if (anyFail && !anyOk) {
      // rollback half-baked assets created in this op
      createdAssetIds.forEach(aid => {
        getState().files = getState().files.filter(f => f.skillId !== aid);
        getState().instances = getState().instances.filter(i => i.skillId !== aid);
        getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== aid);
        getState().assets = getState().assets.filter(a => a.id !== aid);
      });
      op.status = 'failed';
      op.results = results;
      op.completedAt = $now();
      addAuditEvent({ eventType: 'install_failed', category: 'install', source: 'Skill Panel', result: 'failed', note: '安装失败，已清理半成品' });
      saveState();
      return JSON.parse(JSON.stringify({ ok: false, status: 'failed', operationId, results }));
    }

    if (anyFail && anyOk) {
      op.status = 'partially-completed';
    } else {
      op.status = 'completed';
    }
    op.results = results;
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({ ok: !anyFail, status: op.status, operationId, results, snapshotIds: op.snapshotIds }));
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
    const files = getFilesRawInternal({ instanceId: inst.id });
    return files.map(f => {
      if (f.fileType === 'binary') {
        return { fileId: f.id, relativePath: f.relativePath, fileType: 'binary', content: null, contentHash: f.contentHash, changed: false };
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
        changed: content !== String(f.content || '')
      };
    });
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
    const binding = getState().sourceBindings.find(b => b.skillId === assetId || b.id === (getAssetRaw(assetId) || {}).sourceBindingId);
    const instanceIds = $coerceArray(options.instanceIds);
    const allInst = getState().instances.filter(i => i.skillId === assetId && i.lifecycleStatus !== 'missing');
    const targets = (instanceIds.length ? allInst.filter(i => instanceIds.includes(i.id)) : allInst).map(i => ({
      instanceId: i.id, hostType: i.hostType, path: i.skillFilePath
    }));
    if (!targets.length) return { ok: false, code: 'no_target' };

    // permission / hash re-check prep
    for (const t of targets) {
      const perm = getInstancePermission(t.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied', error: '无写权限' };
    }

    const remoteFiles = buildRemoteCandidateFiles(assetId, binding);
    const selectedPaths = options.selectedRelativePaths
      ? $coerceArray(options.selectedRelativePaths)
      : remoteFiles.filter(f => f.changed).map(f => f.relativePath);

    const snapIds = [];
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '更新前 Package Snapshot', source: 'pre-update', retained: true
      });
      if (snap) { getState().snapshots.push(snap); snapIds.push(snap.id); }
    });
    if (!snapIds.length) return { ok: false, code: 'snapshot_failed' };

    const preparedAt = $now();
    const fileStates = targets.map(t => ({
      instanceId: t.instanceId,
      files: getFilesRawInternal({ instanceId: t.instanceId }).map(f => ({
        fileId: f.id, relativePath: f.relativePath, contentHash: f.contentHash, modifiedAt: f.modifiedAt, sizeBytes: f.sizeBytes
      }))
    }));

    const op = {
      id: uuid(),
      type: 'update',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId, bindingId: binding.id },
      targets,
      selectedRelativePaths: selectedPaths,
      remoteFiles: remoteFiles.map(f => ({
        fileId: f.fileId, relativePath: f.relativePath, fileType: f.fileType,
        contentHash: f.contentHash, changed: f.changed
        // content kept privately on op._remoteContents
      })),
      _remoteContents: remoteFiles.reduce((m, f) => { m[f.relativePath] = f.content; return m; }, {}),
      baselineSnapshotId: binding.baselineSnapshotId,
      snapshotIds: snapIds,
      preparedFileStates: fileStates,
      confirmationHash: $hash(JSON.stringify({ assetId, selectedPaths, snapIds })),
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
    // Re-check file states
    for (const group of op.preparedFileStates) {
      for (const prep of group.files) {
        const cur = getFileRawInternal(prep.fileId);
        if (!cur || cur.contentHash !== prep.contentHash) {
          op.status = 'conflict';
          saveState();
          return { ok: false, code: 'conflict', error: '确认前文件状态已变化', operationId };
        }
      }
      const perm = getInstancePermission(group.instanceId);
      if (!perm || !perm.writeAccess) return { ok: false, code: 'permission-denied' };
    }

    op.confirmedAt = $now();
    const sim = getState().installSim || {};
    const results = [];
    let anyFail = false;

    op.targets.forEach(t => {
      const targetResults = [];
      op.selectedRelativePaths.forEach(rel => {
        const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === rel);
        if (!file) {
          targetResults.push({ relativePath: rel, status: 'skipped' });
          return;
        }
        if (sim.updateFailRelativePath && rel === sim.updateFailRelativePath) {
          targetResults.push({ relativePath: rel, status: 'failed', errorCode: 'write_failed' });
          anyFail = true;
          return;
        }
        if (file.fileType === 'binary') {
          targetResults.push({ relativePath: rel, status: 'skipped', message: 'binary meta-only' });
          return;
        }
        const remote = op._remoteContents[rel];
        if (remote == null) {
          targetResults.push({ relativePath: rel, status: 'skipped' });
          return;
        }
        file.content = String(remote);
        file.contentHash = $hash(file.content);
        file.modifiedAt = $now();
        file.sizeBytes = file.content.length;
        targetResults.push({ relativePath: rel, status: 'completed' });
      });

      if (anyFail) {
        // rollback this instance from pre-update snapshot
        const snapId = op.snapshotIds.find(id => {
          const s = getState().snapshots.find(x => x.id === id);
          return s && s.instanceId === t.instanceId;
        }) || op.snapshotIds[0];
        const snap = getState().snapshots.find(s => s.id === snapId);
        targetResults.forEach(r => {
          if (r.status !== 'completed') return;
          const sf = snap && (snap.files || []).find(f => f.relativePath === r.relativePath);
          const file = getFilesRawInternal({ instanceId: t.instanceId }).find(f => f.relativePath === r.relativePath);
          if (file && sf && sf.content != null) {
            file.content = String(sf.content);
            file.contentHash = sf.contentHash || $hash(file.content);
            r.status = 'rolled-back';
            r.rollbackStatus = 'rolled-back';
          } else {
            r.status = 'rollback-failed';
            r.rollbackStatus = 'rollback-failed';
          }
        });
      }

      results.push({ instanceId: t.instanceId, files: targetResults, status: targetResults.some(x => x.status === 'failed' || x.status === 'rollback-failed') ? 'failed' : 'completed' });
    });

    const binding = getState().sourceBindings.find(b => b.id === op.source.bindingId);
    if (!anyFail && binding) {
      binding.baselineVersion = op.remoteVersion;
      binding.baselineCommit = op.remoteCommit;
      binding.remoteVersion = op.remoteVersion;
      binding.remoteCommit = op.remoteCommit;
      binding.updateStatus = 'up-to-date';
      binding.lastCheckedAt = $now();
      // new baseline snapshot from first target
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
    } else {
      addAuditEvent({
        skillId: op.source.assetId, eventType: 'update_failed', category: 'update',
        source: 'Skill Panel', result: 'failed', snapshotId: op.snapshotIds[0],
        note: '更新失败并回滚'
      });
    }

    op.results = results;
    op.status = anyFail ? 'rolled-back' : 'completed';
    op.completedAt = $now();
    // clear private bodies from persisted op for safety when saving — keep for session
    saveState();
    return JSON.parse(JSON.stringify({
      ok: !anyFail,
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
    if (caseId === 'update-available') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.9';
    } else if (caseId === 'update-partial-fail') {
      sim.forceUpdateAvailable = true;
      sim.remoteVersion = '9.9.8';
      sim.updateFailRelativePath = 'references/guide.md';
      // fallback to checklist if needed
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
    const mode = options.mode || 'stop-managing'; // stop-managing | remove-from-host | delete-local-copy | detach-source
    const instanceIds = $coerceArray(options.instanceIds);
    const all = getState().instances.filter(i => i.skillId === assetId);
    const targets = (instanceIds.length ? all.filter(i => instanceIds.includes(i.id)) : all).map(i => ({
      instanceId: i.id,
      hostType: i.hostType,
      path: i.skillFilePath,
      fileCount: getFilesRawInternal({ instanceId: i.id }).length,
      lifecycleStatus: i.lifecycleStatus
    }));
    if (!targets.length && mode !== 'detach-source') return { ok: false, code: 'no_target' };

    const snapIds = [];
    targets.forEach(t => {
      const snap = createPackageSnapshotForInstance(t.instanceId, {
        note: '卸载前 Package Snapshot', source: 'pre-uninstall', retained: true
      });
      if (snap) { getState().snapshots.push(snap); snapIds.push(snap.id); }
    });

    const preparedAt = $now();
    const op = {
      id: uuid(),
      type: 'uninstall',
      status: 'prepared',
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + PHASE_F_OP_TTL_MS).toISOString(),
      source: { assetId },
      mode,
      deleteFiles: !!options.deleteFiles,
      detachSource: mode === 'detach-source' || !!options.detachSource,
      targets,
      snapshotIds: snapIds,
      confirmationHash: $hash(JSON.stringify({ assetId, mode, targets: targets.map(t => t.instanceId), deleteFiles: !!options.deleteFiles })),
      impact: {
        assetId,
        instanceCount: targets.length,
        remainingInstances: all.length - targets.length,
        draftCount: getState().drafts.filter(d => d.skillId === assetId).length,
        hasSourceBinding: getState().sourceBindings.some(b => b.skillId === assetId)
      },
      results: [],
      confirmedAt: null,
      completedAt: null
    };
    getState().uninstallOperations.push(op);
    saveState();
    return JSON.parse(JSON.stringify({
      ok: true,
      operationId: op.id,
      mode,
      targets,
      impact: op.impact,
      snapshotIds: snapIds,
      requiresSecondConfirm: !!op.deleteFiles,
      simulated: true,
      note: '原型不会真实删除宿主文件系统文件'
    }));
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
    if (op.deleteFiles && !options.secondConfirmed) {
      return { ok: false, code: 'second_confirm_required', error: '删除本地副本需要二次确认' };
    }
    op.confirmedAt = $now();
    const assetId = op.source.assetId;
    const results = [];
    const sim = getState().installSim || {};

    if (op.detachSource && (!op.targets.length || op.mode === 'detach-source')) {
      getState().sourceBindings = getState().sourceBindings.filter(b => b.skillId !== assetId);
      const asset = getAssetRaw(assetId);
      if (asset) asset.sourceBindingId = null;
      results.push({ scope: 'source-binding', status: 'completed', message: '已解除 SourceBinding，未删除文件' });
      addAuditEvent({ skillId: assetId, eventType: 'source_detached', category: 'uninstall', source: 'Skill Panel', result: 'completed', note: '解除来源绑定' });
    }

    op.targets.forEach(t => {
      if (sim.uninstallFailInstanceId && sim.uninstallFailInstanceId === t.instanceId) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'sim_fail' });
        return;
      }
      const inst = getInstanceRaw(t.instanceId);
      if (!inst) {
        results.push({ instanceId: t.instanceId, status: 'failed', errorCode: 'missing' });
        return;
      }
      if (op.mode === 'stop-managing' || op.mode === 'remove-from-host') {
        // Default: do not delete files from Formal Index unless deleteFiles
        inst.lifecycleStatus = 'stopped';
        inst.isPrimary = false;
        results.push({
          instanceId: t.instanceId,
          status: 'completed',
          filesDeleted: false,
          message: op.deleteFiles ? '将删除本地副本（模拟）' : '已停止管理，未删除文件'
        });
        if (op.deleteFiles) {
          getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
          results[results.length - 1].filesDeleted = true;
          results[results.length - 1].message = '已从 Formal Index 移除文件记录（非真实磁盘删除）';
        }
      } else if (op.mode === 'delete-local-copy') {
        getState().files = getState().files.filter(f => f.instanceId !== t.instanceId);
        inst.lifecycleStatus = 'deleted';
        results.push({ instanceId: t.instanceId, status: 'completed', filesDeleted: true, message: '已删除 Formal Index 副本记录（模拟）' });
      } else {
        inst.lifecycleStatus = 'stopped';
        results.push({ instanceId: t.instanceId, status: 'completed', filesDeleted: false });
      }
      addAuditEvent({
        skillId: assetId, instanceId: t.instanceId,
        eventType: 'uninstall_instance', category: 'uninstall', source: 'Skill Panel', result: 'completed',
        snapshotId: op.snapshotIds[0],
        note: op.mode + ' · ' + (t.path || '')
      });
    });

    // Asset lifecycle if last instance stopped
    const remaining = getState().instances.filter(i =>
      i.skillId === assetId && i.lifecycleStatus !== 'stopped' && i.lifecycleStatus !== 'deleted' && i.lifecycleStatus !== 'missing');
    const asset = getAssetRaw(assetId);
    if (asset && remaining.length === 0 && op.targets.length) {
      asset.lifecycleStatus = 'archived';
      asset.updatedAt = $now();
      // pick a primary among stopped if needed — none available
      asset.primaryInstanceId = null;
    } else if (asset && remaining.length) {
      if (!remaining.some(i => i.isPrimary)) remaining[0].isPrimary = true;
      asset.primaryInstanceId = remaining.find(i => i.isPrimary).id;
    }

    const anyFail = results.some(r => r.status === 'failed');
    op.results = results;
    op.status = anyFail ? 'partially-completed' : 'completed';
    op.completedAt = $now();
    saveState();
    return JSON.parse(JSON.stringify({
      ok: !anyFail,
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
