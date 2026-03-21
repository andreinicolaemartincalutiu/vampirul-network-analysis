let networkData = null;
let svg, g, simulation, link, node, label, zoom;
let showLabels = true;
let currentFilter = 'all';
let selectedCharacter = null;
let vampireMerged = false;
let vampireAvatars = [];
let vampireMergedNode = null;
let communityView = false;
let communityGraphData = null;
let selectedCommunity = null;

const communityColors = ['#FFB347', '#87CEEB', '#DDA0DD', '#F08080', '#90EE90', '#F0E68C', '#FFB6C1', '#20B2AA'];
const genderIcons = { M: '♂', F: '♀', C: '♂♀', Unknown: '?' };
const posColors = { NOUN: '#4a90e2', VERB: '#10b981', ADJ: '#f59e0b', ADV: '#8b5cf6', OTHER: '#6b7280' };

function openDrawer(characterData) {
    selectedCharacter = characterData;
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-title').textContent = characterData.label;

    const identityTab = document.getElementById('identity-tab');
    identityTab.style.display = (isVampireAvatar(characterData) || characterData.identity_type === 'merged') ? 'block' : 'none';

    renderOverviewTab(characterData);
    renderConnectionsTab(characterData);
    renderVocabularyTab(characterData);
    renderCommunityTab(characterData);
    if (isVampireAvatar(characterData) || characterData.identity_type === 'merged') {
        renderIdentityTab(characterData);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.drawer-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

function renderOverviewTab(char) {
    const container = document.getElementById('character-profile');
    const ca = char.connections_analysis || {};
    const genderIcon = genderIcons[char.gender] || genderIcons['Unknown'];
    const genderLabel = { M: 'Male', F: 'Female', C: 'Collective' }[char.gender] || 'Unknown';
    const isSilentOnly = char.dialogue_count === 0 && (ca.total_connections || 0) > 0;

    container.innerHTML = `
                <div class="profile-header">
                    <div class="profile-name">${char.label}</div>
                    <div class="profile-gender">${genderIcon} ${genderLabel}</div>
                </div>
                ${isSilentOnly ? `<div style="background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.4);padding:12px 15px;border-radius:8px;margin-bottom:20px;">
                    <div><div style="color:#ffc107;font-weight:600;margin-bottom:3px;">Silent Participant Only</div>
                    <div style="color:var(--text-secondary);font-size:0.9em;">This character appears in scenes but never speaks.</div></div></div></div>` : ''}
                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-label">Dialogues</div><div class="stat-value">${char.dialogue_count}</div></div>
                    <div class="stat-box"><div class="stat-label">Connections</div><div class="stat-value">${ca.total_connections || 0}</div></div>
                    <div class="stat-box"><div class="stat-label">Total Words</div><div class="stat-value">${(ca.total_words_exchanged || 0).toLocaleString()}</div></div>
                    <div class="stat-box"><div class="stat-label">Centrality</div><div class="stat-value">${(char.degree_centrality * 100).toFixed(1)}%</div></div>
                </div>
                <div class="chart-container"><div class="chart-title">Gender Distribution of Partners</div><div id="gender-chart"></div></div>
                <div class="chart-container"><div class="chart-title">Top 5 Partners</div><div id="top-partners-chart"></div></div>
            `;

    if (ca.gender_distribution) renderGenderChart(ca.gender_distribution);
    if (ca.top_5_partners) renderTopPartnersChart(ca.top_5_partners);
}

function renderGenderChart(genderDist) {
    const container = d3.select('#gender-chart');
    container.html('');
    const data = Object.entries(genderDist).filter(([, v]) => v > 0).map(([gender, count]) => ({ gender, count }));
    if (!data.length) return;
    const width = 440, barH = 25, labelW = 90;
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).range([0, width - labelW - 50]);
    const svg = container.append('svg').attr('width', width).attr('height', data.length * (barH + 5));
    const bars = svg.selectAll('g').data(data).join('g').attr('transform', (d, i) => `translate(0,${i * (barH + 5)})`);
    bars.append('rect').attr('x', labelW).attr('width', d => x(d.count)).attr('height', barH)
        .attr('fill', d => ({ M: '#4a90e2', F: '#ec4899', C: '#8b5cf6' }[d.gender] || '#666')).attr('opacity', 0.8);
    bars.append('text').attr('x', labelW - 5).attr('y', barH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', '#9195a0').style('font-size', '11px')
        .text(d => `${genderIcons[d.gender] || '?'} ${{ M: 'Male', F: 'Female', C: 'Collective' }[d.gender] || 'Unknown'}`);
    bars.append('text').attr('x', d => labelW + x(d.count) + 5).attr('y', barH / 2).attr('dy', '0.35em').attr('fill', '#e8eaed').style('font-size', '13px').style('font-weight', 'bold').text(d => d.count);
}

function renderTopPartnersChart(partners) {
    const container = d3.select('#top-partners-chart');
    container.html('');
    if (!partners || !partners.length) return;
    const width = 440, barH = 30, labelW = 130;
    const x = d3.scaleLinear().domain([0, d3.max(partners, d => d.weight)]).range([0, width - labelW - 60]);
    const svg = container.append('svg').attr('width', width).attr('height', partners.length * (barH + 5));
    const bars = svg.selectAll('g').data(partners).join('g').attr('transform', (d, i) => `translate(0,${i * (barH + 5)})`);
    bars.append('rect').attr('x', labelW).attr('width', d => x(d.weight)).attr('height', barH).attr('fill', '#d4af37').attr('opacity', 0.7);
    bars.append('text').attr('x', labelW - 5).attr('y', barH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', '#e8eaed').style('font-size', '10px')
        .text(d => { const n = d.name.length > 18 ? d.name.substring(0, 18) + '…' : d.name; return `${genderIcons[d.gender] || ''} ${n}`; });
    bars.append('text').attr('x', d => labelW + x(d.weight) + 5).attr('y', barH / 2).attr('dy', '0.35em').attr('fill', '#d4af37').style('font-size', '12px').style('font-weight', 'bold').text(d => d.weight);
}

function renderConnectionsTab(char) {
    const ca = char.connections_analysis || {};
    const partners = ca.partners || [];
    const searchBox = document.getElementById('partner-search');
    const genderFilter = document.getElementById('gender-filter');
    const sortBy = document.getElementById('sort-by');
    searchBox.value = ''; genderFilter.value = 'all'; sortBy.value = 'weight';

    function updateTable() {
        let filtered = [...partners];
        const term = searchBox.value.toLowerCase();
        if (term) filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
        if (genderFilter.value !== 'all') filtered = filtered.filter(p => p.gender === genderFilter.value);
        filtered.sort((a, b) => b[sortBy.value] - a[sortBy.value]);
        renderPartnersTable(filtered);
    }
    searchBox.oninput = updateTable;
    genderFilter.onchange = updateTable;
    sortBy.onchange = updateTable;
    updateTable();
}

function renderPartnersTable(partners) {
    const container = document.getElementById('partners-table');
    if (!partners || !partners.length) {
        container.innerHTML = '<p style="color:#9195a0;text-align:center;padding:20px;">No partners found</p>';
        return;
    }
    const maxWeight = Math.max(...partners.map(p => p.weight));
    const hasVocab = partners.some(p => p.vocab_overlap_score != null);

    container.innerHTML = `<table>
                <thead><tr>
                    <th>Partner</th>
                    <th>Direct</th>
                    <th>Co-pres</th>
                    <th>Words</th>
                    <th>Weight</th>
                    ${hasVocab ? '<th title="Jaccard similarity between words used with this partner vs overall vocabulary">Vocab</th>' : ''}
                </tr></thead>
                <tbody>
                ${partners.map(p => {
        const icon = genderIcons[p.gender] || '';
        const gClass = p.gender ? `gender-${p.gender}` : '';
        const barW = (p.weight / maxWeight * 100).toFixed(1);
        const overlapCell = hasVocab
            ? `<td>${p.vocab_overlap_score != null
                ? `<span class="overlap-pill">⟷ ${(p.vocab_overlap_score * 100).toFixed(0)}%</span>`
                : '<span style="color:var(--text-secondary);font-size:0.8em;">—</span>'}</td>`
            : '';
        const exclusiveHtml = (p.exclusive_words_to_partner && p.exclusive_words_to_partner.length)
            ? `<div style="margin-top:5px;">${p.exclusive_words_to_partner.slice(0, 5).map(w => `<span class="exclusive-tag">${w}</span>`).join('')}</div>`
            : '';
        return `<tr onmouseover="highlightConnection('${selectedCharacter.id}','${p.name}')" onmouseout="clearConnectionHighlight()">
                        <td class="partner-name"><span class="gender-icon ${gClass}">${icon}</span>${p.name}${exclusiveHtml}</td>
                        <td class="metric-cell">${p.direct_dialogues}</td>
                        <td class="metric-cell">${p.copresence}</td>
                        <td class="metric-cell">${p.total_words.toLocaleString()}</td>
                        <td class="metric-cell">${p.weight}<div class="metric-bar" style="width:${barW}%"></div></td>
                        ${overlapCell}
                    </tr>`;
    }).join('')}
                </tbody></table>
                ${hasVocab ? `<p style="color:var(--text-secondary);font-size:0.78em;margin-top:10px;line-height:1.4;">
                    <strong style="color:var(--accent-gold);">Vocab ↔</strong> — how much of this character's global vocabulary appears in this specific relationship (Jaccard similarity). 
                    Coloured tags below partner names are words used <em>exclusively</em> with that partner.</p>` : ''}`;
}

function highlightConnection(sourceId, targetId) {
    link.each(function (d) {
        const connected = (d.source.id === sourceId && d.target.id === targetId) || (d.target.id === sourceId && d.source.id === targetId);
        d3.select(this).classed('highlighted', connected).classed('dimmed', !connected);
    });
    node.each(function (d) {
        const hi = d.id === sourceId || d.id === targetId;
        d3.select(this).classed('highlighted', hi).classed('dimmed', !hi);
    });
}
function clearConnectionHighlight() {
    link.classed('highlighted', false).classed('dimmed', false);
    node.classed('highlighted', false).classed('dimmed', false);
}

function renderVocabularyTab(char) {
    const container = document.getElementById('vocabulary-content');
    const vp = char.vocabulary_profile;

    if (!vp || vp.data_reliability === 'none') {
        container.innerHTML = `<div style="padding:20px;text-align:center;">
                    <p style="color:var(--text-secondary);">No vocabulary data available for this character.</p>
                    <p style="color:var(--text-secondary);font-size:0.85em;margin-top:10px;">
                        Run <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;">enrich_vocabulary.py</code> 
                        and load <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;">network_data_with_vocabulary_final.json</code>.
                    </p></div>`;
        return;
    }

    const reliabilityClass = `reliability-${vp.data_reliability}`;
    const reliabilityLabel = { high: 'High', medium: 'Medium', low: 'Low ⚠' }[vp.data_reliability] || vp.data_reliability;

    let html = `
            <div class="vocab-section">
                <div class="vocab-section-title">Lexical Profile
                    <span class="reliability-badge ${reliabilityClass}" style="margin-left:10px;">${reliabilityLabel} Reliability</span>
                </div>
                <div class="vocab-stats-grid">
                    <div class="vocab-stat-box">
                        <div class="vocab-stat-label">MTLD</div>
                        <div class="vocab-stat-value">${vp.mtld !== null ? vp.mtld.toFixed(1) : '—'}</div>
                        <div class="vocab-stat-sub">Lexical diversity</div>
                    </div>
                    <div class="vocab-stat-box">
                        <div class="vocab-stat-label">TTR</div>
                        <div class="vocab-stat-value">${vp.ttr !== null ? (vp.ttr * 100).toFixed(1) + '%' : '—'}</div>
                        <div class="vocab-stat-sub">Type-token ratio</div>
                    </div>
                    <div class="vocab-stat-box">
                        <div class="vocab-stat-label">Unique Lemmas</div>
                        <div class="vocab-stat-value">${vp.unique_lemmas.toLocaleString()}</div>
                        <div class="vocab-stat-sub">Distinct words</div>
                    </div>
                    <div class="vocab-stat-box">
                        <div class="vocab-stat-label">Avg Word Length</div>
                        <div class="vocab-stat-value">${vp.avg_word_length !== null ? vp.avg_word_length.toFixed(1) : '—'}</div>
                        <div class="vocab-stat-sub">Characters / word</div>
                    </div>
                </div>
            </div>`;

    if (vp.pos_distribution && Object.keys(vp.pos_distribution).length) {
        const posOrder = ['NOUN', 'VERB', 'ADJ', 'ADV'];
        const allPos = [...posOrder, ...Object.keys(vp.pos_distribution).filter(p => !posOrder.includes(p))];
        html += `<div class="vocab-section">
                    <div class="vocab-section-title">Part-of-Speech Distribution</div>`;
        allPos.forEach(pos => {
            const pct = vp.pos_distribution[pos];
            if (!pct) return;
            const color = posColors[pos] || posColors.OTHER;
            html += `<div class="pos-bar-row">
                        <span class="pos-bar-label">${pos}</span>
                        <div class="pos-bar-track"><div class="pos-bar-fill" style="width:${pct}%;background:${color};"></div></div>
                        <span class="pos-bar-pct">${pct}%</span>
                    </div>`;
        });
        html += `</div>`;
    }

    if (vp.top_words && vp.top_words.length) {
        const maxCount = vp.top_words[0].count;
        html += `<div class="vocab-section">
                    <div class="vocab-section-title">Most Used Words</div>
                    <div class="word-cloud">
                    ${vp.top_words.map(w => {
            const sizePct = 82 + 26 * (w.count / maxCount);
            return `<span class="word-chip" style="font-size:${sizePct.toFixed(0)}%;">${w.word}<span class="word-chip-count">${w.count}</span></span>`;
        }).join('')}
                    </div>
                </div>`;
    }

    const relVocab = vp.vocabulary_per_relationship;
    if (relVocab && Object.keys(relVocab).length) {
        const sorted = Object.entries(relVocab).sort((a, b) => (b[1].total_words || 0) - (a[1].total_words || 0));

        html += `<div class="vocab-section">
                    <div class="vocab-section-title">Vocabulary Per Relationship</div>
                    <p style="color:var(--text-secondary);font-size:0.82em;margin-bottom:12px;line-height:1.4;">
                        How this character's vocabulary shifts depending on who they're speaking to. Click a partner to expand.
                    </p>
                    <div class="rel-vocab-accordion">`;

        sorted.forEach(([partner, rv], idx) => {
            const overlap = rv.vocab_overlap_with_global != null
                ? `<span class="overlap-pill">⟷ ${(rv.vocab_overlap_with_global * 100).toFixed(0)}%</span>` : '';
            const note = rv.data_note
                ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:5px 10px;margin-bottom:10px;font-size:0.78em;color:#f59e0b;">⚠ ${rv.data_note}</div>` : '';

            const wordsHtml = rv.top_words && rv.top_words.length
                ? `<div style="margin-bottom:10px;">
                            <div style="font-size:0.8em;color:var(--accent-gold);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;opacity:0.75;">Top words in this relationship</div>
                            <div class="word-cloud">
                            ${rv.top_words.slice(0, 10).map(w => `<span class="word-chip" style="font-size:0.8em;">${w.word}<span class="word-chip-count">${w.count}</span></span>`).join('')}
                            </div></div>` : '';

            const exclusiveHtml = rv.exclusive_words && rv.exclusive_words.length
                ? `<div>
                            <div style="font-size:0.8em;color:var(--accent-gold);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;opacity:0.75;">Words exclusive to this relationship</div>
                            <div>${rv.exclusive_words.map(w => `<span class="exclusive-tag">${w}</span>`).join('')}</div></div>` : '';

            const metaRow = `<div style="font-size:0.8em;color:var(--text-secondary);margin-top:8px;display:flex;gap:16px;">
                        ${rv.ttr != null ? `<span>TTR: <strong style="color:var(--text-primary);">${(rv.ttr * 100).toFixed(1)}%</strong></span>` : ''}
                        <span>Words: <strong style="color:var(--text-primary);">${rv.total_words || '—'}</strong></span>
                        ${rv.avg_word_length != null ? `<span>Avg len: <strong style="color:var(--text-primary);">${rv.avg_word_length}</strong></span>` : ''}
                    </div>`;

            html += `<div class="rel-vocab-partner">
                        <div class="rel-vocab-header" onclick="toggleRelVocab(${idx})">
                            <span class="rel-vocab-header-name">${partner}</span>
                            <div class="rel-vocab-header-meta">
                                ${overlap}
                                <span class="rel-vocab-arrow" id="rva-${idx}">▼</span>
                            </div>
                        </div>
                        <div class="rel-vocab-body" id="rvb-${idx}">
                            ${note}${wordsHtml}${exclusiveHtml}${metaRow}
                        </div>
                    </div>`;
        });
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

function toggleRelVocab(idx) {
    const body = document.getElementById(`rvb-${idx}`);
    const arrow = document.getElementById(`rva-${idx}`);
    body.classList.toggle('open');
    arrow.classList.toggle('open');
}

function renderCommunityTab(char) {
    const container = document.getElementById('community-info');
    const ca = char.connections_analysis || {};
    const members = ca.community_members || [];
    container.innerHTML = `
                <div class="stat-box"><div class="stat-label">Community ID</div><div class="stat-value">${char.community}</div></div>
                <div class="chart-container" style="margin-top:20px;">
                    <div class="chart-title">Community Members (${members.length})</div>
                    <div style="max-height:400px;overflow-y:auto;">
                        ${members.map(m => `<div style="padding:8px;border-bottom:1px solid var(--border);color:var(--text-primary);">${m}</div>`).join('')}
                    </div>
                </div>`;
}

function buildCommunityGraph() {
    const commMap = new Map();

    networkData.nodes.forEach(n => {
        if (n.hidden) return;
        const c = n.community;
        if (!commMap.has(c)) {
            commMap.set(c, {
                id: c,
                label: `Community ${c}`,
                members: [],
                totalDialogues: 0,
                totalWords: 0,
                totalDegree: 0,
                genderDist: { M: 0, F: 0, C: 0, Unknown: 0 }
            });
        }
        const comm = commMap.get(c);
        comm.members.push(n);
        comm.totalDialogues += n.dialogue_count || 0;
        comm.totalWords += (n.connections_analysis?.total_words_exchanged || 0);
        comm.totalDegree += n.degree || 0;
        const g = n.gender || 'Unknown';
        if (g in comm.genderDist) comm.genderDist[g]++;
    });

    commMap.forEach(comm => {
        comm.members.sort((a, b) => b.dialogue_count - a.dialogue_count);
        comm.topSpeaker = comm.members[0];
        comm.mostCentral = [...comm.members].sort((a, b) => b.betweenness_centrality - a.betweenness_centrality)[0];
    });

    const edgeMap = new Map();
    networkData.edges.forEach(e => {
        const src = e.source.id || e.source;
        const tgt = e.target.id || e.target;
        const srcNode = networkData.nodes.find(n => n.id === src);
        const tgtNode = networkData.nodes.find(n => n.id === tgt);
        if (!srcNode || !tgtNode) return;
        const cA = srcNode.community, cB = tgtNode.community;
        if (cA === cB) {
            const comm = commMap.get(cA);
            if (comm) { comm.intraWeight = (comm.intraWeight || 0) + (e.weight || 0); }
            return;
        }
        const key = [Math.min(cA, cB), Math.max(cA, cB)].join('-');
        if (!edgeMap.has(key)) {
            edgeMap.set(key, {
                source: cA, target: cB,
                weight: 0, direct: 0, words: 0,
                bridges: new Set(),
                pairWeights: new Map()
            });
        }
        const ed = edgeMap.get(key);
        ed.weight += e.weight || 0;
        ed.direct += e.direct || 0;
        ed.words += e.words || 0;
        const pairKey = `${src}|||${tgt}`;
        ed.pairWeights.set(pairKey, (ed.pairWeights.get(pairKey) || 0) + (e.weight || 0));
        ed.bridges.add(src); ed.bridges.add(tgt);
    });

    commMap.forEach(comm => {
        const totalW = comm.members.reduce((s, n) => {
            return s + networkData.edges.filter(e => {
                const s1 = e.source.id || e.source, t1 = e.target.id || e.target;
                return s1 === n.id || t1 === n.id;
            }).reduce((ss, e) => ss + (e.weight || 0), 0);
        }, 0);
        comm.totalEdgeWeight = totalW;
        comm.cohesionRatio = totalW > 0 ? ((comm.intraWeight || 0) * 2) / totalW : 0;

        comm.members.forEach(n => {
            const myEdges = networkData.edges.filter(e => {
                const s1 = e.source.id || e.source, t1 = e.target.id || e.target;
                return s1 === n.id || t1 === n.id;
            });
            const totalW = myEdges.reduce((s, e) => s + (e.weight || 0), 0);
            const intraW = myEdges.filter(e => {
                const otherId = (e.source.id || e.source) === n.id ? (e.target.id || e.target) : (e.source.id || e.source);
                const other = networkData.nodes.find(x => x.id === otherId);
                return other && other.community === n.community;
            }).reduce((s, e) => s + (e.weight || 0), 0);
            n._outwardRatio = totalW > 0 ? 1 - intraW / totalW : 0;
        });
    });

    const edges = [];
    edgeMap.forEach((ed, key) => {
        let bestPair = null, bestW = 0;
        ed.pairWeights.forEach((w, pk) => { if (w > bestW) { bestW = w; bestPair = pk; } });
        ed.dominantPair = bestPair ? bestPair.split('|||') : null;
        ed.bridgeCount = ed.bridges.size;
        delete ed.bridges; delete ed.pairWeights;
        edges.push(ed);
    });

    const nodes = Array.from(commMap.values());
    communityGraphData = { nodes, edges, commMap };
}

function isVampireAvatar(n) { return n.meta_identity === 'Vampirul'; }

function renderCommunityView() {
    g.selectAll('*').remove();
    const { nodes, edges } = communityGraphData;
    document.getElementById('stat-nodes').textContent = nodes.length;
    document.getElementById('stat-edges').textContent = edges.length;
    document.getElementById('stat-communities').textContent = nodes.length;

    const container = document.getElementById('network-container');
    const width = container.clientWidth, height = container.clientHeight;

    document.getElementById('vampire-toggle').disabled = true;
    document.getElementById('vampire-toggle').style.opacity = '0.4';

    const commSim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(180).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-600))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => Math.max(30, Math.sqrt(d.totalDialogues) * 2.5) + 20));

    const commLink = g.append('g').selectAll('line')
        .data(edges).join('line')
        .attr('class', 'comm-link')
        .attr('stroke-width', d => Math.max(1, Math.sqrt(d.weight) * 0.6));

    const commNode = g.append('g').selectAll('circle')
        .data(nodes).join('circle')
        .attr('class', 'comm-node')
        .attr('r', d => Math.max(22, Math.sqrt(d.totalDialogues) * 2.2))
        .attr('fill', d => communityColors[d.id % communityColors.length])
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('fill-opacity', 0.85)
        .call(d3.drag()
            .on('start', (e) => { if (!e.active) commSim.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
            .on('drag', (e) => { e.subject.fx = e.x; e.subject.fy = e.y; })
            .on('end', (e) => { if (!e.active) commSim.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; }))
        .on('mouseover', (event, d) => {
            commNode.classed('dimmed', n => n.id !== d.id);
            commLink.classed('highlighted', e => e.source.id === d.id || e.target.id === d.id)
                .classed('dimmed', e => e.source.id !== d.id && e.target.id !== d.id);
            const tt = document.getElementById('tooltip');
            tt.innerHTML = `
                        <div class="tooltip-title" style="color:${communityColors[d.id % communityColors.length]}">Community ${d.id}</div>
                        <div class="tooltip-stat"><span class="tooltip-stat-label">Members:</span><span class="tooltip-stat-value">${d.members.length}</span></div>
                        <div class="tooltip-stat"><span class="tooltip-stat-label">Dialogues:</span><span class="tooltip-stat-value">${d.totalDialogues}</span></div>
                        <div class="tooltip-stat"><span class="tooltip-stat-label">Cohesion:</span><span class="tooltip-stat-value">${(d.cohesionRatio * 100).toFixed(0)}%</span></div>
                        <div class="tooltip-stat"><span class="tooltip-stat-label">Top speaker:</span><span class="tooltip-stat-value">${d.topSpeaker?.label || '—'}</span></div>`;
            tt.style.left = (event.pageX + 15) + 'px'; tt.style.top = (event.pageY + 15) + 'px'; tt.style.opacity = 1;
        })
        .on('mouseout', () => {
            commNode.classed('dimmed', false);
            commLink.classed('highlighted', false).classed('dimmed', false);
            document.getElementById('tooltip').style.opacity = 0;
        })
        .on('click', (event, d) => openCommunityDrawer(d));

    const commLabel = g.append('g').selectAll('text')
        .data(nodes).join('text')
        .attr('class', 'comm-label')
        .attr('text-anchor', 'middle')
        .attr('dy', d => Math.max(22, Math.sqrt(d.totalDialogues) * 2.2) + 16)
        .attr('fill', '#e8eaed')
        .text(d => `Community ${d.id} (${d.members.length})`);

    simulation = commSim;

    commSim.on('tick', () => {
        commLink.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        commNode.attr('cx', d => d.x).attr('cy', d => d.y);
        commLabel.attr('x', d => d.x).attr('y', d => d.y);
    });
}

function renderIndividualView() {
    document.getElementById('vampire-toggle').disabled = false;
    document.getElementById('vampire-toggle').style.opacity = '1';
    document.getElementById('stat-nodes').textContent = networkData.metadata.total_nodes;
    document.getElementById('stat-edges').textContent = networkData.metadata.total_edges;
    document.getElementById('stat-communities').textContent = networkData.metadata.total_communities;
    renderNetwork();
}

function toggleCommunityView() {
    communityView = !communityView;
    const btn = document.getElementById('community-toggle');
    if (communityView) {
        btn.classList.add('active');
        if (vampireMerged) { vampireMerged = false; splitVampireIdentities(); }
        buildCommunityGraph();
        renderCommunityView();
        closeDrawer();
    } else {
        btn.classList.remove('active');
        renderIndividualView();
        closeDrawer();
    }
}

function initializeVampireSystem() {
    vampireAvatars = networkData.nodes.filter(n => n.meta_identity === 'Vampirul');
}

function toggleVampireMerge() {
    vampireMerged = !vampireMerged;
    const btn = document.getElementById('vampire-toggle');
    if (vampireMerged) { btn.classList.add('active'); btn.innerHTML = '🎭 Split Vampire'; mergeVampireIdentities(); }
    else { btn.classList.remove('active'); btn.innerHTML = '🎭 Merge Vampire'; splitVampireIdentities(); }
}

function mergeVampireIdentities() {
    if (!vampireAvatars.length) return;
    const trueForm = vampireAvatars.find(a => a.identity_type === 'true_form') || vampireAvatars[0];
    const totalDialogues = vampireAvatars.reduce((s, a) => s + a.dialogue_count, 0);
    const avgX = vampireAvatars.reduce((s, a) => s + (a.x || 0), 0) / vampireAvatars.length;
    const avgY = vampireAvatars.reduce((s, a) => s + (a.y || 0), 0) / vampireAvatars.length;
    const partnersMap = new Map();
    const genderDist = { M: 0, F: 0, C: 0, Unknown: 0 };
    let totalWordsExchanged = 0;
    vampireAvatars.forEach(avatar => {
        const ca = avatar.connections_analysis;
        if (ca && ca.partners) ca.partners.forEach(p => {
            if (vampireAvatars.some(v => v.id === p.name)) return;
            if (partnersMap.has(p.name)) {
                const ex = partnersMap.get(p.name);
                ex.direct_dialogues += p.direct_dialogues || 0; ex.copresence += p.copresence || 0;
                ex.total_words += p.total_words || 0; ex.weight += p.weight || 0;
            } else {
                partnersMap.set(p.name, { ...p });
                const g = p.gender || 'Unknown'; if (g in genderDist) genderDist[g]++;
            }
            totalWordsExchanged += p.total_words || 0;
        });
    });
    const allPartners = Array.from(partnersMap.values()).sort((a, b) => b.weight - a.weight);
    vampireMergedNode = {
        id: 'Vampirul (Merged)', label: 'Vampirul (True Form)', x: avgX, y: avgY, fx: avgX, fy: avgY,
        dialogue_count: totalDialogues, degree: allPartners.length,
        degree_centrality: trueForm.degree_centrality, betweenness_centrality: trueForm.betweenness_centrality,
        closeness_centrality: trueForm.closeness_centrality, eigenvector_centrality: trueForm.eigenvector_centrality,
        community: trueForm.community, gender: 'M', meta_identity: 'Vampirul', identity_type: 'merged',
        connections_analysis: { partners: allPartners, top_5_partners: allPartners.slice(0, 5), gender_distribution: genderDist, total_words_exchanged: totalWordsExchanged, total_connections: allPartners.length },
        avatars: vampireAvatars.map(a => ({ name: a.id, dialogues: a.dialogue_count, words: a.connections_analysis?.total_words_exchanged || 0, type: a.identity_type }))
    };
    vampireAvatars.forEach(a => a.hidden = true);
    networkData.nodes.push(vampireMergedNode);
    renderNetwork();
    setTimeout(() => { if (vampireMerged) simulation.alpha(0).stop(); }, 1000);
}

function splitVampireIdentities() {
    vampireAvatars.forEach(a => a.hidden = false);
    const idx = networkData.nodes.findIndex(n => n.id === 'Vampirul (Merged)');
    if (idx > -1) networkData.nodes.splice(idx, 1);
    vampireMergedNode = null;
    renderNetwork();
    setTimeout(() => simulation.alpha(0.3).restart(), 100);
}

function openCommunityDrawer(commData) {
    selectedCommunity = commData;
    const drawer = document.getElementById('drawer');
    drawer.classList.add('open');

    document.getElementById('drawer-title').innerHTML =
        `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${communityColors[commData.id % communityColors.length]};margin-right:8px;vertical-align:middle;"></span>Community ${commData.id}`;

    ['overview', 'connections', 'vocabulary', 'community', 'identity-tab'].forEach(id => {
        const el = id === 'identity-tab'
            ? document.getElementById('identity-tab')
            : document.querySelector(`[data-tab="${id}"]`);
        if (el) el.style.display = 'none';
    });
    ['cv-tab-overview', 'cv-tab-members', 'cv-tab-interactions', 'cv-tab-cohesion'].forEach(id => {
        document.getElementById(id).style.display = 'block';
    });

    ['tab-overview', 'tab-connections', 'tab-vocabulary', 'tab-community', 'tab-identity'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });

    document.querySelectorAll('.drawer-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('cv-tab-overview').classList.add('active');
    document.getElementById('tab-cv-overview').classList.add('active');

    renderCVOverview(commData);
    renderCVMembers(commData);
    renderCVInteractions(commData);
    renderCVCohesion(commData);
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('open');
    selectedCharacter = null;
    selectedCommunity = null;

    ['overview', 'connections', 'vocabulary', 'community'].forEach(id => {
        const el = document.querySelector(`[data-tab="${id}"]`);
        if (el) el.style.display = 'block';
    });
    ['cv-tab-overview', 'cv-tab-members', 'cv-tab-interactions', 'cv-tab-cohesion'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    ['tab-cv-overview', 'tab-cv-members', 'tab-cv-interactions', 'tab-cv-cohesion'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });

    document.querySelectorAll('.drawer-tab').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="overview"]').classList.add('active');
    document.getElementById('tab-overview').classList.add('active');

    if (link) link.classed('highlighted', false).classed('dimmed', false);
    if (node) node.classed('highlighted', false).classed('dimmed', false);
}

function renderCVOverview(comm) {
    const color = communityColors[comm.id % communityColors.length];
    const gd = comm.genderDist;
    const totalMembers = comm.members.length;

    document.getElementById('tab-cv-overview').innerHTML = `
                <div style="text-align:center;padding:20px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;margin-bottom:20px;border-top:3px solid ${color};">
                    <div style="font-size:2em;font-weight:300;color:${color};font-family:'Space Mono',monospace;">Community ${comm.id}</div>
                    <div style="color:var(--text-secondary);font-size:0.9em;margin-top:4px;">${totalMembers} members</div>
                </div>
                <div class="comm-stat-grid">
                    <div class="comm-stat-box"><div class="comm-stat-label">Total Dialogues</div><div class="comm-stat-value">${comm.totalDialogues.toLocaleString()}</div></div>
                    <div class="comm-stat-box"><div class="comm-stat-label">Total Words</div><div class="comm-stat-value">${comm.totalWords.toLocaleString()}</div></div>
                    <div class="comm-stat-box"><div class="comm-stat-label">Cohesion</div><div class="comm-stat-value">${(comm.cohesionRatio * 100).toFixed(0)}%</div><div class="comm-stat-sub">internal interactions</div></div>
                    <div class="comm-stat-box"><div class="comm-stat-label">Connections</div><div class="comm-stat-value">${comm.totalDegree}</div><div class="comm-stat-sub">sum of degrees</div></div>
                </div>
                <div class="comm-section">
                    <div class="comm-section-title">Key Members</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div class="comm-stat-box">
                            <div class="comm-stat-label">Top Speaker</div>
                            <div style="font-size:1em;font-weight:600;color:var(--accent-gold);margin-top:4px;">${comm.topSpeaker?.label || '—'}</div>
                            <div class="comm-stat-sub">${comm.topSpeaker?.dialogue_count || 0} dialogues</div>
                        </div>
                        <div class="comm-stat-box">
                            <div class="comm-stat-label">Most Central</div>
                            <div style="font-size:1em;font-weight:600;color:var(--accent-gold);margin-top:4px;">${comm.mostCentral?.label || '—'}</div>
                            <div class="comm-stat-sub">${((comm.mostCentral?.betweenness_centrality || 0) * 100).toFixed(1)}% betweenness</div>
                        </div>
                    </div>
                </div>
                <div class="comm-section">
                    <div class="comm-section-title">Gender Distribution</div>
                    ${['M', 'F', 'C', 'Unknown'].filter(g => gd[g] > 0).map(g => {
        const pct = (gd[g] / totalMembers * 100).toFixed(0);
        const col = { M: '#4a90e2', F: '#ec4899', C: '#8b5cf6', Unknown: '#6b7280' }[g];
        const lbl = { M: 'Male', F: 'Female', C: 'Collective', Unknown: 'Unknown' }[g];
        return `<div style="margin-bottom:8px;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:0.85em;">
                                <span style="color:var(--text-secondary);">${lbl}</span>
                                <span style="font-family:'Space Mono',monospace;color:var(--text-primary);">${gd[g]} (${pct}%)</span>
                            </div>
                            <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
                                <div style="width:${pct}%;height:100%;background:${col};border-radius:3px;"></div>
                            </div>
                        </div>`;
    }).join('')}
                </div>`;
}

function renderCVMembers(comm) {
    const color = communityColors[comm.id % communityColors.length];
    const rows = comm.members.map((m, idx) => `
                <div class="comm-member-row" onclick="jumpToCharacter('${m.id}')">
                    <div>
                        <span style="font-family:'Space Mono',monospace;font-size:0.7em;color:${color};margin-right:8px;">${idx + 1}</span>
                        <span class="comm-member-name">${m.label}</span>
                        <span style="font-size:0.78em;color:var(--text-secondary);margin-left:8px;">${{ M: '♂', F: '♀', C: '♂♀' }[m.gender] || '?'}</span>
                    </div>
                    <div style="text-align:right;">
                        <div class="comm-member-meta">${m.dialogue_count} dialogues</div>
                        <div class="comm-member-meta">${(m.degree_centrality * 100).toFixed(1)}% centrality</div>
                    </div>
                </div>`).join('');

    document.getElementById('tab-cv-members').innerHTML = `
                <div class="comm-section">
                    <div class="comm-section-title">All Members — sorted by dialogue count</div>
                    <p style="color:var(--text-secondary);font-size:0.82em;margin-bottom:12px;">Click any member to open their character profile.</p>
                    ${rows}
                </div>`;
}

function renderCVInteractions(comm) {
    const { edges, commMap } = communityGraphData;
    const myEdges = edges.filter(e => e.source === comm.id || e.source.id === comm.id || e.target === comm.id || e.target.id === comm.id);
    const maxW = Math.max(...myEdges.map(e => e.weight), 1);

    const rows = myEdges.sort((a, b) => b.weight - a.weight).map((e, idx) => {
        const otherId = (e.source === comm.id || e.source.id === comm.id)
            ? (e.target.id ?? e.target)
            : (e.source.id ?? e.source);
        const other = commMap.get(otherId);
        if (!other) return '';
        const otherColor = communityColors[otherId % communityColors.length];
        const barPct = (e.weight / maxW * 100).toFixed(0);

        let bridgeHtml = '';
        if (e.dominantPair) {
            const [a, b] = e.dominantPair;
            const nodeA = networkData.nodes.find(n => n.id === a);
            const nodeB = networkData.nodes.find(n => n.id === b);
            bridgeHtml = `<div style="font-size:0.8em;color:var(--text-secondary);margin-top:6px;">
                        Dominant bridge: <strong style="color:var(--text-primary);">${nodeA?.label || a}</strong>
                        <span style="color:var(--accent-gold);margin:0 4px;">↔</span>
                        <strong style="color:var(--text-primary);">${nodeB?.label || b}</strong>
                    </div>`;
        }

        const myBridgeMembers = new Set();
        const theirBridgeMembers = new Set();
        networkData.edges.forEach(ne => {
            const s = ne.source.id || ne.source, t = ne.target.id || ne.target;
            const sNode = networkData.nodes.find(n => n.id === s);
            const tNode = networkData.nodes.find(n => n.id === t);
            if (!sNode || !tNode) return;
            if (sNode.community === comm.id && tNode.community === otherId) { myBridgeMembers.add(s); theirBridgeMembers.add(t); }
            if (tNode.community === comm.id && sNode.community === otherId) { myBridgeMembers.add(t); theirBridgeMembers.add(s); }
        });

        return `<div class="comm-inter-row">
                    <div class="comm-inter-header" onclick="toggleCommInter(${idx})">
                        <div style="display:flex;align-items:center;">
                            <span class="comm-swatch" style="background:${otherColor};"></span>
                            <span style="font-size:0.95em;font-weight:600;color:var(--text-primary);">Community ${otherId}</span>
                            <span style="font-size:0.78em;color:var(--text-secondary);margin-left:8px;">${other.members.length} members</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="font-family:'Space Mono',monospace;font-size:0.8em;color:var(--accent-gold);">${e.weight} weight</span>
                            <span class="comm-inter-arrow" id="cia-${idx}">▼</span>
                        </div>
                    </div>
                    <div class="comm-inter-body" id="cib-${idx}">
                        <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:12px;overflow:hidden;">
                            <div style="width:${barPct}%;height:100%;background:${otherColor};border-radius:2px;"></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Direct</div><div style="font-family:'Space Mono',monospace;font-size:1.1em;color:var(--text-primary);">${e.direct}</div></div>
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Words</div><div style="font-family:'Space Mono',monospace;font-size:1.1em;color:var(--text-primary);">${e.words.toLocaleString()}</div></div>
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Bridges</div><div style="font-family:'Space Mono',monospace;font-size:1.1em;color:var(--text-primary);">${myBridgeMembers.size} ↔ ${theirBridgeMembers.size}</div></div>
                        </div>
                        ${bridgeHtml}
                    </div>
                </div>`;
    }).join('');

    document.getElementById('tab-cv-interactions').innerHTML = `
                <div class="comm-section">
                    <div class="comm-section-title">Cross-Community Interactions</div>
                    <p style="color:var(--text-secondary);font-size:0.82em;margin-bottom:12px;line-height:1.4;">
                        How this community relates to others. Bridge count shows how many members on each side participate in cross-community dialogue.
                    </p>
                    ${rows || '<p style="color:var(--text-secondary);padding:20px;text-align:center;">No cross-community interactions found.</p>'}
                </div>`;
}

function renderCVCohesion(comm) {
    const internalPct = (comm.cohesionRatio * 100).toFixed(1);
    const externalPct = (100 - comm.cohesionRatio * 100).toFixed(1);

    const memberRows = [...comm.members]
        .sort((a, b) => b._outwardRatio - a._outwardRatio)
        .map(m => {
            const outPct = (m._outwardRatio * 100).toFixed(0);
            return `<div class="cohesion-bar-row">
                        <div class="cohesion-bar-label" title="${m.label}">${m.label}</div>
                        <div class="cohesion-bar-track">
                            <div class="cohesion-bar-fill" style="width:${outPct}%;background:${outPct > 60 ? '#ef4444' : outPct > 30 ? '#f59e0b' : '#10b981'};"></div>
                        </div>
                        <div class="cohesion-bar-pct">${outPct}%</div>
                    </div>`;
        }).join('');

    document.getElementById('tab-cv-cohesion').innerHTML = `
                <div class="comm-section">
                    <div class="comm-section-title">Internal vs External Split</div>
                    <div style="margin-bottom:20px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.85em;">
                            <span style="color:#10b981;">Internal ${internalPct}%</span>
                            <span style="color:#ef4444;">External ${externalPct}%</span>
                        </div>
                        <div style="height:12px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;display:flex;">
                            <div style="width:${internalPct}%;background:#10b981;border-radius:6px 0 0 6px;"></div>
                            <div style="width:${externalPct}%;background:#ef4444;border-radius:0 6px 6px 0;"></div>
                        </div>
                        <p style="color:var(--text-secondary);font-size:0.78em;margin-top:8px;line-height:1.4;">
                            A high internal ratio means this community is self-contained. A high external ratio means its members look outward — narratively significant for bridge characters.
                        </p>
                    </div>
                </div>
                <div class="comm-section">
                    <div class="comm-section-title">Outward-Facing Ratio per Member</div>
                    <p style="color:var(--text-secondary);font-size:0.82em;margin-bottom:14px;line-height:1.4;">
                        How much of each member's interactions go <em>outside</em> this community.
                        <span style="color:#ef4444;">Red</span> = highly outward,
                        <span style="color:#f59e0b;">amber</span> = mixed,
                        <span style="color:#10b981;">green</span> = mostly internal.
                    </p>
                    ${memberRows}
                </div>`;
}

function toggleCommInter(idx) {
    const body = document.getElementById(`cib-${idx}`);
    const arrow = document.getElementById(`cia-${idx}`);
    body.classList.toggle('open');
    arrow.classList.toggle('open');
}

function jumpToCharacter(charId) {
    if (communityView) {
        communityView = false;
        document.getElementById('community-toggle').classList.remove('active');
        renderIndividualView();
    }
    setTimeout(() => {
        const charData = networkData.nodes.find(n => n.id === charId);
        if (charData) openDrawer(charData);
    }, 100);
}

function renderIdentityTab(char) {
    const container = document.getElementById('identity-info');
    const isMerged = char.identity_type === 'merged';
    const avatarsList = isMerged ? char.avatars : vampireAvatars.map(a => ({ name: a.id, dialogues: a.dialogue_count, words: a.connections_analysis?.total_words_exchanged || 0, type: a.identity_type }));
    const totalDialogues = avatarsList.reduce((s, a) => s + a.dialogues, 0);
    const totalWords = avatarsList.reduce((s, a) => s + (a.words || 0), 0);
    container.innerHTML = `
                <div style="text-align:center;padding:20px;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(139,92,246,0.1));border-radius:8px;margin-bottom:20px;">
                    <div style="font-size:2em;margin-bottom:10px;">🎭</div>
                    <h3 style="color:var(--accent-gold);margin-bottom:5px;">THE VAMPIRE</h3>
                    <p style="color:var(--text-secondary);font-size:0.9em;">A being of many faces</p>
                </div>
                <div class="merged-stats-box"><div style="text-align:center;margin-bottom:15px;"><div style="font-size:0.85em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Combined Statistics</div></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div><div style="font-size:0.8em;color:var(--text-secondary);">Total Dialogues</div><div style="font-size:1.5em;font-weight:bold;color:#8b5cf6;">${totalDialogues}</div></div>
                        <div><div style="font-size:0.8em;color:var(--text-secondary);">Total Words</div><div style="font-size:1.5em;font-weight:bold;color:#ef4444;">${totalWords.toLocaleString()}</div></div>
                        <div><div style="font-size:0.8em;color:var(--text-secondary);">Personas</div><div style="font-size:1.5em;font-weight:bold;color:var(--accent-gold);">${avatarsList.length}</div></div>
                        <div><div style="font-size:0.8em;color:var(--text-secondary);">Identity</div><div style="font-size:1.5em;font-weight:bold;color:#8b5cf6;">Fluid</div></div>
                    </div>
                </div>
                <h4 style="color:var(--accent-gold);margin:20px 0 10px;font-size:0.9em;text-transform:uppercase;letter-spacing:1px;">Manifestations</h4>
                <div class="identity-grid">
                    ${avatarsList.map(a => `<div class="identity-card ${a.type === 'true_form' ? 'true-form' : ''}">
                        <div class="identity-name">${a.type === 'true_form' ? '👑 ' : '🎭 '}${a.name}</div>
                        <div class="identity-stat">${a.dialogues} dialogues</div>
                        <div class="identity-stat" style="color:${a.type === 'true_form' ? '#8b5cf6' : '#ef4444'};">${a.type === 'true_form' ? 'True Form' : 'Avatar'}</div>
                    </div>`).join('')}
                </div>`;
}

async function loadData() {
    try {
        const response = await fetch('/network_data_with_vocabulary_final.json');
        networkData = await response.json();
        document.getElementById('loading').style.display = 'none';
        updateStats();
        initializeVampireSystem();
        initVisualization();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').textContent = 'Error loading data. Make sure network_data_with_vocabulary_final.json is in the same folder.';
    }
}

function updateStats() {
    document.getElementById('stat-nodes').textContent = networkData.metadata.total_nodes;
    document.getElementById('stat-edges').textContent = networkData.metadata.total_edges;
    document.getElementById('stat-communities').textContent = networkData.metadata.total_communities;
}

function initVisualization() {
    const container = document.getElementById('network-container');
    const width = container.clientWidth, height = container.clientHeight;
    svg = d3.select('#network-container').append('svg').attr('width', width).attr('height', height);
    zoom = d3.zoom().scaleExtent([0.1, 10]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    g = svg.append('g');
    simulation = d3.forceSimulation(networkData.nodes)
        .force('link', d3.forceLink(networkData.edges).id(d => d.id).distance(d => d.direct > d.copresence ? 80 : 150).strength(d => Math.min((d.weight || 1) / 50, 1)))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));
    renderNetwork();
    setupControls();
    window.addEventListener('resize', () => {
        const w = container.clientWidth, h = container.clientHeight;
        svg.attr('width', w).attr('height', h);
        simulation.force('center', d3.forceCenter(w / 2, h / 2)).alpha(0.3).restart();
    });
}

function renderNetwork() {
    if (communityView) return;
    const minDialogues = parseInt(document.getElementById('min-dialogues').value);
    const minWeight = parseInt(document.getElementById('min-weight').value);
    let filteredNodes = networkData.nodes.filter(n => !n.hidden && n.dialogue_count >= minDialogues);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    let edgesToUse = networkData.edges;
    if (vampireMerged && vampireMergedNode) {
        edgesToUse = networkData.edges.map(e => {
            const src = e.source.id || e.source, tgt = e.target.id || e.target;
            const srcV = vampireAvatars.some(a => a.id === src), tgtV = vampireAvatars.some(a => a.id === tgt);
            if (srcV && tgtV) return null;
            if (srcV) return { ...e, source: vampireMergedNode.id };
            if (tgtV) return { ...e, target: vampireMergedNode.id };
            return e;
        }).filter(Boolean);
    }
    let filteredEdges = edgesToUse.filter(e => {
        if (!nodeIds.has(e.source.id || e.source) || !nodeIds.has(e.target.id || e.target)) return false;
        if (e.weight < minWeight) return false;
        if (currentFilter === 'direct') return e.direct > 0;
        if (currentFilter === 'copresence') return e.copresence > 0;
        return true;
    });
    g.selectAll('*').remove();
    link = g.append('g').selectAll('line').data(filteredEdges).join('line')
        .attr('class', d => { if (currentFilter === 'direct') return 'link link-direct'; if (currentFilter === 'copresence') return 'link link-copresence'; return d.direct > d.copresence ? 'link link-direct' : 'link link-copresence'; })
        .attr('stroke-width', d => { const w = currentFilter === 'direct' ? d.direct : currentFilter === 'copresence' ? d.copresence : d.weight; return Math.sqrt(w) * 0.8; })
        .attr('stroke-opacity', 0.6);
    node = g.append('g').selectAll('circle').data(filteredNodes).join('circle')
        .attr('class', d => { let c = ['node']; if (d.meta_identity === 'Vampirul') { if (d.identity_type === 'avatar') c.push('vampire-avatar'); else if (d.identity_type === 'true_form') c.push('vampire-true-form'); else if (d.identity_type === 'merged') c.push('vampire-merged'); } return c.join(' '); })
        .attr('r', d => d.identity_type === 'merged' ? Math.max(20, Math.sqrt(d.dialogue_count) * 3) : Math.max(5, Math.sqrt(d.dialogue_count) * 2))
        .attr('fill', d => d.identity_type === 'merged' ? '#8b5cf6' : communityColors[d.community % communityColors.length])
        .attr('stroke', d => { if (d.meta_identity === 'Vampirul' && d.identity_type === 'avatar') return '#ef4444'; if (d.identity_type === 'merged') return '#8b5cf6'; return '#fff'; })
        .attr('stroke-width', d => d.meta_identity === 'Vampirul' ? 3 : 2)
        .call(drag(simulation)).on('mouseover', handleNodeHover).on('mouseout', handleNodeOut).on('click', handleNodeClick);
    label = g.append('g').selectAll('text').data(filteredNodes).join('text')
        .attr('class', 'node-label').attr('text-anchor', 'middle')
        .attr('dy', d => Math.max(5, Math.sqrt(d.dialogue_count) * 2) + 15)
        .text(d => d.label).style('fill', '#e8eaed').style('display', showLabels ? 'block' : 'none');
    simulation.nodes(filteredNodes);
    simulation.force('link').links(filteredEdges);
    simulation.alpha(1).restart();
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('cx', d => d.x).attr('cy', d => d.y);
        label.attr('x', d => d.x).attr('y', d => d.y);
    });
}

function handleNodeHover(event, d) {
    const vp = d.vocabulary_profile;
    const vocabLine = vp && vp.data_reliability !== 'none'
        ? `<div class="tooltip-stat"><span class="tooltip-stat-label">MTLD:</span><span class="tooltip-stat-value">${vp.mtld != null ? vp.mtld.toFixed(1) : '—'}</span></div>
                    <div class="tooltip-stat"><span class="tooltip-stat-label">Unique lemmas:</span><span class="tooltip-stat-value">${vp.unique_lemmas || '—'}</span></div>`
        : '';
    document.getElementById('tooltip').innerHTML = `
                <div class="tooltip-title">${d.label}</div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Dialogues:</span><span class="tooltip-stat-value">${d.dialogue_count}</span></div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Connections:</span><span class="tooltip-stat-value">${d.degree}</span></div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Centrality:</span><span class="tooltip-stat-value">${(d.degree_centrality * 100).toFixed(1)}%</span></div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Betweenness:</span><span class="tooltip-stat-value">${(d.betweenness_centrality * 100).toFixed(1)}%</span></div>
                ${vocabLine}
                <div class="tooltip-stat"><span class="tooltip-stat-label">Community:</span><span class="tooltip-stat-value">${d.community}</span></div>`;
    const tt = document.getElementById('tooltip');
    tt.style.left = (event.pageX + 15) + 'px'; tt.style.top = (event.pageY + 15) + 'px'; tt.style.opacity = 1;
    const connectedIds = new Set();
    link.each(function (l) {
        const connected = l.source.id === d.id || l.target.id === d.id;
        d3.select(this).classed('highlighted', connected).classed('dimmed', !connected);
        if (connected) { connectedIds.add(l.source.id); connectedIds.add(l.target.id); }
    });
    node.each(function (n) { const hi = connectedIds.has(n.id); d3.select(this).classed('highlighted', hi).classed('dimmed', !hi); });
}

function handleNodeOut() {
    document.getElementById('tooltip').style.opacity = 0;
    link.classed('highlighted', false).classed('dimmed', false);
    node.classed('highlighted', false).classed('dimmed', false);
}

function handleNodeClick(event, d) { openDrawer(d); }

function drag(simulation) {
    return d3.drag()
        .on('start', (e) => { if (!e.active) simulation.alphaTarget(0.3).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
        .on('drag', (e) => { e.subject.fx = e.x; e.subject.fy = e.y; })
        .on('end', (e) => { if (!e.active) simulation.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; });
}

function setupControls() {
    document.getElementById('min-dialogues').addEventListener('input', e => { document.getElementById('min-dialogues-value').textContent = e.target.value; renderNetwork(); });
    document.getElementById('min-weight').addEventListener('input', e => { document.getElementById('min-weight-value').textContent = e.target.value; renderNetwork(); });
    document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', e => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active'); currentFilter = e.target.dataset.filter; renderNetwork();
    }));
    document.getElementById('toggle-labels').addEventListener('click', () => {
        showLabels = !showLabels;
        g.selectAll('.node-label, .comm-label').style('display', showLabels ? 'block' : 'none');
    }); document.getElementById('reset-zoom').addEventListener('click', () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));
    document.getElementById('vampire-toggle').addEventListener('click', toggleVampireMerge);
    document.getElementById('community-toggle').addEventListener('click', toggleCommunityView);
    document.getElementById('export-svg').addEventListener('click', () => {
        const blob = new Blob([svg.node().outerHTML], { type: 'image/svg+xml' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'character-network.svg'; a.click();
    });
    document.getElementById('export-png').addEventListener('click', () => {
        const drawerOpen = document.getElementById('drawer').classList.contains('open');
        const target = drawerOpen
            ? document.getElementById('drawer')
            : document.getElementById('network-container');
        const filename = drawerOpen
            ? communityView
                ? `community-${selectedCommunity?.id ?? 'drawer'}.png`
                : `character-${(selectedCharacter?.label || 'drawer').replace(/\s+/g, '-').toLowerCase()}.png`
            : communityView ? 'community-network.png' : 'character-network.png';
        html2canvas(target, {
            backgroundColor: '#151925',
            scale: 2,
            useCORS: true,
            logging: false
        }).then(canvas => {
            canvas.toBlob(b => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(b);
                a.download = filename;
                a.click();
            });
        });
    });
}

loadData();