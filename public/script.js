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
let hideCollectives = false;
let predationEntityNodes = [];   // groups/entities that take part in predation but are not network characters
let chapterFrom = null;   // chapter index range (null = whole novel)
let chapterTo = null;

const communityColors = ['#FFB347', '#87CEEB', '#DDA0DD', '#F08080', '#90EE90', '#F0E68C', '#FFB6C1', '#20B2AA'];
const genderIcons = { M: '♂', F: '♀', C: '♂♀', Unknown: '?' };
const posColors = { NOUN: '#4a90e2', VERB: '#10b981', ADJ: '#f59e0b', ADV: '#8b5cf6', OTHER: '#6b7280' };

function getDataUrl() {
    if (window.NETWORK_CONFIG && window.NETWORK_CONFIG.dataUrl) return window.NETWORK_CONFIG.dataUrl;
    let seg = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    if (!seg) seg = 'vampirul-character-network';
    const slug = seg.replace(/-character-network$/, '');
    return `${slug}-network-data.json`;
}

function identityConfig() {
    const c = (window.NETWORK_CONFIG && window.NETWORK_CONFIG.identity) || {};
    return {
        sectionTitle: c.sectionTitle || 'Vampire Identity',
        caption: c.caption || 'Combine personas into a single entity',
        mergeLabel: c.mergeLabel || 'Merge Vampire',
        splitLabel: c.splitLabel || 'Split Vampire',
        title: c.title || 'THE VAMPIRE',
        subtitle: c.subtitle || 'A being of many faces',
        marker: c.marker || 'The vampire of the novel'
    };
}

function hasMultipleIdentities() {
    return vampireAvatars.length >= 2;
}

function applyFeatureAvailability() {
    const vBtn = document.getElementById('vampire-toggle');
    if (!vBtn) return;
    const section = vBtn.closest('.control-section');
    const has = hasMultipleIdentities();
    if (section) section.style.display = has ? '' : 'none';
    if (!has) return;
    const cfg = identityConfig();
    if (section) {
        const h3 = section.querySelector('h3');
        const cap = section.querySelector('p');
        if (h3) h3.textContent = cfg.sectionTitle;
        if (cap) cap.textContent = cfg.caption;
    }
    if (!vampireMerged) vBtn.innerHTML = '🎭 ' + cfg.mergeLabel;
}

function openDrawer(characterData) {
    selectedCharacter = characterData;
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-title').textContent = characterData.label;

    const identityTab = document.getElementById('identity-tab');
    const showIdentity = (isVampireAvatar(characterData) && hasMultipleIdentities()) || characterData.identity_type === 'merged';
    identityTab.style.display = showIdentity ? 'block' : 'none';

    const isEntity = !!characterData.entity;
    ['overview', 'connections', 'vocabulary', 'community'].forEach(id => {
        const el = document.querySelector(`[data-tab="${id}"]`);
        if (el) el.style.display = isEntity ? 'none' : 'block';
    });
    showEl('predation-tab', hasPredation() && characterData.predation, 'block');

    if (!isEntity) {
        renderOverviewTab(characterData);
        renderConnectionsTab(characterData);
        renderVocabularyTab(characterData);
        renderCommunityTab(characterData);
    }
    if (hasPredation() && characterData.predation) renderPredationTab(characterData);
    const activeBtn = document.querySelector('.drawer-tab.active');
    if (isEntity) switchTab('predation');
    else if (!activeBtn || activeBtn.style.display === 'none') switchTab('overview');
    if (showIdentity) {
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
                    ${char.rank ? `<div class="profile-gender" style="margin-top:4px;font-size:0.95em;">${char.rank}${char.rank_status === 'confirmed' ? '' : ' <span style="opacity:0.6;">(draft rank)</span>'}</div>` : ''}
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
                ${hasChapters() ? '<div class="chart-container"><div class="chart-title">Activity by Chapter <span style="text-transform:none;letter-spacing:0;">(gold = lines spoken, purple = lines present)</span></div><div id="chapter-activity-chart"></div></div>' : ''}
            `;

    if (ca.gender_distribution) renderGenderChart(ca.gender_distribution);
    if (ca.top_5_partners) renderTopPartnersChart(ca.top_5_partners);
    if (hasChapters()) renderChapterActivityChart(char.chapter_activity || {});
}

// elements added for chapter / predation data exist only on pages that need them
function showEl(id, visible, display = '') {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? display : 'none';
    return el;
}

function hasPredation() {
    return !!(networkData && networkData.metadata && networkData.metadata.predation);
}

function predationRangeCounts(p) {
    // agent / patient totals of a participant within the selected chapter range
    if (!p) return { agent: 0, patient: 0 };
    if (!chapterRangeActive()) return { agent: p.agent.total, patient: p.patient.total };
    const sum = obj => Object.entries(obj || {}).reduce((s, [idx, v]) => s + (inChapterRange(idx) ? v : 0), 0);
    return { agent: sum(p.agent_by_chapter), patient: sum(p.patient_by_chapter) };
}

function predationColor(agent, patient) {
    if (agent + patient === 0) return '#555';
    return d3.interpolateRdBu(1 - agent / (agent + patient));   // 1 = only preys → red, 0 = only preyed on → blue
}

function renderPredationTab(char) {
    const el = document.getElementById('predation-info');
    const p = char.predation;
    const md = networkData.metadata.predation || {};
    if (!p) { el.innerHTML = '<p style="color:var(--text-secondary);">No validated predation events.</p>'; return; }
    const ratio = p.ratio === null || p.ratio === undefined ? '—' : (p.ratio * 100).toFixed(0) + '%';
    const byRole = role => p.events.filter(e => e.role === role);
    const evHtml = e => {
        const s = e.sentence, o = e.sentence_offset, n = e.trigger.length;
        const other = e.role === 'agent' ? (e.patient || 'unspecified') : (e.agent || 'unspecified');
        return `<div class="pred-event ${e.sense}">
            <div class="pred-event-meta">${e.chapter} · ${e.sense} · ${e.source}${e.speaker ? ' (' + e.speaker + ')' : ''} · ${e.role === 'agent' ? '→' : '←'} ${other}</div>
            ${s.slice(0, o)}<span class="pred-trigger">${s.slice(o, o + n)}</span>${s.slice(o + n)}
            ${e.notes ? `<div class="pred-event-meta" style="margin-top:4px;">Note: ${e.notes}</div>` : ''}
        </div>`;
    };
    el.innerHTML = `
        ${md.complete === false ? '<div class="pred-provisional">Validation not finished — these counts are provisional.</div>' : ''}
        ${char.rank ? `<div class="stat-label" style="margin-bottom:12px;">Rank: <span style="color:var(--text-primary);">${char.rank}</span></div>` : ''}
        <div class="profile-stats">
            <div class="stat-box"><div class="stat-label">As agent</div><div class="stat-value">${p.agent.total}</div>
                <div class="vocab-stat-sub">${p.agent.literal} literal · ${p.agent.figurative} figurative</div></div>
            <div class="stat-box"><div class="stat-label">As patient</div><div class="stat-value">${p.patient.total}</div>
                <div class="vocab-stat-sub">${p.patient.literal} literal · ${p.patient.figurative} figurative</div></div>
            <div class="stat-box"><div class="stat-label">Predation ratio</div><div class="stat-value">${ratio}</div>
                <div class="vocab-stat-sub">agent / (agent + patient)</div></div>
            <div class="stat-box"><div class="stat-label">Narration / dialogue</div>
                <div class="stat-value" style="font-size:1.2em;">${(p.agent_by_source.narration || 0) + (p.patient_by_source.narration || 0)} / ${(p.agent_by_source.dialogue || 0) + (p.patient_by_source.dialogue || 0)}</div></div>
        </div>
        <div class="vocab-section" style="margin-top:20px;"><div class="vocab-section-title">As agent (${byRole('agent').length})</div>${byRole('agent').map(evHtml).join('') || '<p style="color:var(--text-secondary);">—</p>'}</div>
        <div class="vocab-section"><div class="vocab-section-title">As patient (${byRole('patient').length})</div>${byRole('patient').map(evHtml).join('') || '<p style="color:var(--text-secondary);">—</p>'}</div>`;
}

function hasChapters() {
    return !!(networkData && networkData.metadata && (networkData.metadata.chapters || []).length);
}

const CHAPTER_NUMBERS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE',
    'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];

function chapterShortLabel(label) {
    // "CHAPTER TWENTY-ONE" → "21", "PROLOGUE" → "P", "AFTERWORD" → "A"
    const w = label.replace('CHAPTER ', '');
    const parts = w.split('-');
    if (parts.length === 2 && parts[0] === 'TWENTY' && CHAPTER_NUMBERS.indexOf(parts[1]) > -1) return String(21 + CHAPTER_NUMBERS.indexOf(parts[1]));
    if (CHAPTER_NUMBERS.indexOf(w) > -1) return String(CHAPTER_NUMBERS.indexOf(w) + 1);
    return w.charAt(0);
}

function renderChapterActivityChart(activity) {
    const container = d3.select('#chapter-activity-chart');
    container.html('');
    const chapters = networkData.metadata.chapters;
    const data = chapters.map(c => {
        const a = activity[String(c.index)] || { spoken: 0, present: 0 };
        return { index: c.index, label: c.label, spoken: a.spoken, present: a.present };
    });
    const width = 600, height = 150, margin = { top: 10, right: 10, bottom: 24, left: 30 };
    const x = d3.scaleBand().domain(data.map(d => d.index)).range([margin.left, width - margin.right]).padding(0.15);
    const yMax = d3.max(data, d => Math.max(d.present, d.spoken)) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([height - margin.bottom, margin.top]);
    const svgC = container.append('svg').attr('width', width).attr('height', height);
    svgC.append('g').selectAll('rect.present').data(data).join('rect')
        .attr('class', 'chapter-bar').attr('x', d => x(d.index)).attr('width', x.bandwidth())
        .attr('y', d => y(d.present)).attr('height', d => y(0) - y(d.present))
        .attr('fill', '#8b5cf6').attr('opacity', 0.35)
        .append('title').text(d => `${d.label}: ${d.spoken} spoken / ${d.present} present`);
    svgC.append('g').selectAll('rect.spoken').data(data).join('rect')
        .attr('class', 'chapter-bar').attr('x', d => x(d.index) + x.bandwidth() * 0.2).attr('width', x.bandwidth() * 0.6)
        .attr('y', d => y(d.spoken)).attr('height', d => y(0) - y(d.spoken))
        .attr('fill', '#d4af37').attr('opacity', 0.9)
        .append('title').text(d => `${d.label}: ${d.spoken} spoken / ${d.present} present`);
    svgC.append('g').attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(i => chapterShortLabel(chapters.find(c => c.index === i).label)))
        .selectAll('text').attr('fill', '#9195a0').style('font-size', '9px');
    svgC.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4))
        .selectAll('text').attr('fill', '#9195a0').style('font-size', '9px');
    svgC.selectAll('.domain, .tick line').attr('stroke', '#2a2f3e');
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

function isVampireAvatar(n) { return n.meta_identity != null; }

function renderCommunityView() {
    g.selectAll('*').remove();
    const { nodes, edges } = communityGraphData;
    document.getElementById('stat-nodes').textContent = nodes.length;
    document.getElementById('stat-edges').textContent = edges.length;
    document.getElementById('stat-communities').textContent = nodes.length;

    const container = document.getElementById('network-container');
    const width = container.clientWidth, height = container.clientHeight;

    const vBtn = document.getElementById('vampire-toggle');
    if (vBtn) { vBtn.disabled = true; vBtn.style.opacity = '0.4'; }

    // const { nodes, edges } = communityGraphData;

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
    const vBtn = document.getElementById('vampire-toggle');
    if (vBtn) { vBtn.disabled = false; vBtn.style.opacity = '1'; }
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
    vampireAvatars = networkData.nodes.filter(n => n.meta_identity != null);
}

function toggleVampireMerge() {
    vampireMerged = !vampireMerged;
    const btn = document.getElementById('vampire-toggle');
    const cfg = identityConfig();
    if (vampireMerged) { btn.classList.add('active'); btn.innerHTML = '🎭 ' + cfg.splitLabel; mergeVampireIdentities(); }
    else { btn.classList.remove('active'); btn.innerHTML = '🎭 ' + cfg.mergeLabel; splitVampireIdentities(); }
}

function mergeVampireIdentities() {
    if (!vampireAvatars.length) return;
    const trueForm = vampireAvatars.find(a => a.identity_type === 'true_form') || vampireAvatars[0];
    const metaName = trueForm.meta_identity || 'Identity';
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
        id: `${metaName} (Merged)`, label: `${metaName} (True Form)`, x: avgX, y: avgY, fx: avgX, fy: avgY,
        dialogue_count: totalDialogues, degree: allPartners.length,
        degree_centrality: trueForm.degree_centrality, betweenness_centrality: trueForm.betweenness_centrality,
        closeness_centrality: trueForm.closeness_centrality, eigenvector_centrality: trueForm.eigenvector_centrality,
        community: trueForm.community, gender: trueForm.gender || 'M', meta_identity: metaName, identity_type: 'merged',
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
    const idx = networkData.nodes.findIndex(n => n.identity_type === 'merged');
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

    ['overview', 'connections', 'vocabulary', 'community', 'identity-tab', 'predation-tab'].forEach(id => {
        const el = (id === 'identity-tab' || id === 'predation-tab')
            ? document.getElementById(id)
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
                    <div style="font-size:2em;font-weight:300;color:${color};font-variant-numeric:tabular-nums;">Community ${comm.id}</div>
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
                                <span style="font-variant-numeric:tabular-nums;color:var(--text-primary);">${gd[g]} (${pct}%)</span>
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
                        <span style="font-variant-numeric:tabular-nums;font-size:0.7em;color:${color};margin-right:8px;">${idx + 1}</span>
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
                            <span style="font-variant-numeric:tabular-nums;font-size:0.8em;color:var(--accent-gold);">${e.weight} weight</span>
                            <span class="comm-inter-arrow" id="cia-${idx}">▼</span>
                        </div>
                    </div>
                    <div class="comm-inter-body" id="cib-${idx}">
                        <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:12px;overflow:hidden;">
                            <div style="width:${barPct}%;height:100%;background:${otherColor};border-radius:2px;"></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Direct</div><div style="font-variant-numeric:tabular-nums;font-size:1.1em;color:var(--text-primary);">${e.direct}</div></div>
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Words</div><div style="font-variant-numeric:tabular-nums;font-size:1.1em;color:var(--text-primary);">${e.words.toLocaleString()}</div></div>
                            <div><div style="font-size:0.72em;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Bridges</div><div style="font-variant-numeric:tabular-nums;font-size:1.1em;color:var(--text-primary);">${myBridgeMembers.size} ↔ ${theirBridgeMembers.size}</div></div>
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
    const cfg = identityConfig();
    container.innerHTML = `
                <div style="text-align:center;padding:20px;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(139,92,246,0.1));border-radius:8px;margin-bottom:20px;">
                    <div style="font-size:2em;margin-bottom:10px;">🎭</div>
                    <h3 style="color:var(--accent-gold);margin-bottom:5px;">${cfg.title}</h3>
                    <p style="color:var(--text-secondary);font-size:0.9em;">${cfg.subtitle}</p>
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
        const response = await fetch(getDataUrl());
        networkData = await response.json();
        document.getElementById('loading').style.display = 'none';
        applyWorkMetadata();
        updateStats();
        initializeVampireSystem();
        initVisualization();
        applyFeatureAvailability();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').textContent = 'Error loading data. Make sure the data json file is in the same folder.';
    }
}

function applyWorkMetadata() {
    const md = networkData.metadata || {};
    const titleEl = document.getElementById('work-title');
    if (md.work_title && titleEl) {
        titleEl.innerHTML = `<i>${md.work_title.toUpperCase()}</i> - CHARACTER NETWORK`;
    }
    // the identity-merge control is handled by applyFeatureAvailability()
    setupChapterControls();
    if (hasPredation() && document.getElementById('predation-filter-btn')) {
        showEl('predation-filter-btn', true);
        predationEntityNodes = (networkData.predation_entities || []).map(e => ({
            ...e, gender: 'C', dialogue_count: 0, degree: 0, degree_centrality: 0, betweenness_centrality: 0,
            community: -1, chapter_activity: null, vocabulary_profile: null, connections_analysis: null }));
        ensurePredationMarker();
    }
    renderProvenance();
}

function ensurePredationMarker() {
    if (!svg || document.getElementById('pred-arrow')) return;
    svg.append('defs').append('marker')
        .attr('id', 'pred-arrow').attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0)
        .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#ef4444');
}

function setupChapterControls() {
    const section = document.getElementById('chapter-section');
    if (!section) return;
    if (!hasChapters()) { section.style.display = 'none'; return; }
    const chapters = networkData.metadata.chapters;
    const opts = chapters.map(c => `<option value="${c.index}">${chapterShortLabel(c.label)}. ${c.label.replace('CHAPTER ', '')} (${c.dialogues})</option>`).join('');
    const from = document.getElementById('chapter-from'), to = document.getElementById('chapter-to');
    from.innerHTML = opts; to.innerHTML = opts;
    from.value = chapters[0].index; to.value = chapters[chapters.length - 1].index;
}

// lines spoken by a character in the selected chapter range (whole novel when no range)
function rangeDialogues(n) {
    if (!chapterRangeActive() || !n.chapter_activity) return n.dialogue_count;
    return Object.entries(n.chapter_activity).reduce((s, [idx, v]) => s + (inChapterRange(idx) ? v.spoken : 0), 0);
}

function rangePresence(n) {
    if (!n.chapter_activity) return 0;
    return Object.entries(n.chapter_activity).reduce((s, [idx, v]) => s + (inChapterRange(idx) ? v.present : 0), 0);
}

function chapterRangeActive() {
    if (!hasChapters() || chapterFrom === null || chapterTo === null) return false;
    const ch = networkData.metadata.chapters;
    return !(chapterFrom === ch[0].index && chapterTo === ch[ch.length - 1].index);
}

function inChapterRange(idx) {
    const i = parseInt(idx, 10);
    return i >= chapterFrom && i <= chapterTo;
}

function onChapterChange(event) {
    const fromEl = document.getElementById('chapter-from'), toEl = document.getElementById('chapter-to');
    let a = parseInt(fromEl.value, 10);
    let b = parseInt(toEl.value, 10);
    // keep the range valid by moving the other end, not by swapping
    if (a > b) {
        if (event && event.target === toEl) { a = b; fromEl.value = a; }
        else { b = a; toEl.value = b; }
    }
    chapterFrom = a; chapterTo = b;
    renderNetwork();
}

function updateChapterNote(nNodes, nEdges) {
    const el = document.getElementById('chapter-note');
    if (!el || !hasChapters()) return;
    if (!chapterRangeActive()) { el.textContent = 'Whole novel'; return; }
    const ch = networkData.metadata.chapters;
    const label = i => ch.find(c => c.index === i).label.replace('CHAPTER ', '');
    const range = chapterFrom === chapterTo ? label(chapterFrom) : `${label(chapterFrom)} → ${label(chapterTo)}`;
    el.textContent = `${range}: ${nNodes} characters, ${nEdges} relationships. Node size and edge weights = selected chapters; centralities = whole novel.`;
}

// works with older copies of character_network.html that do not contain the button
function ensureResetButton() {
    let btn = document.getElementById('reset-filters');
    if (!btn) {
        const section = document.createElement('div');
        section.className = 'control-section';
        section.innerHTML = '<div class="filter-buttons"><button class="btn" id="reset-filters">Reset All Filters</button></div>';
        const panel = document.querySelector('.control-panel');
        panel.insertBefore(section, panel.firstChild);
        btn = document.getElementById('reset-filters');
    }
    return btn;
}

function resetFilters() {
    document.getElementById('min-dialogues').value = 0;
    document.getElementById('min-dialogues-value').textContent = '0';
    document.getElementById('min-weight').value = 0;
    document.getElementById('min-weight-value').textContent = '0';
    currentFilter = 'all';
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
    hideCollectives = false;
    const coll = document.getElementById('toggle-collectives');
    if (coll) { coll.classList.remove('active'); coll.textContent = 'Hide Collectives'; }
    if (hasChapters() && document.getElementById('chapter-from')) {
        const ch = networkData.metadata.chapters;
        chapterFrom = ch[0].index; chapterTo = ch[ch.length - 1].index;
        document.getElementById('chapter-from').value = chapterFrom;
        document.getElementById('chapter-to').value = chapterTo;
    }
    if (communityView) { toggleCommunityView(); } else { renderNetwork(); }
    if (isMobileView()) fitToScreen(); else svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
}

function renderProvenance() {
    const md = networkData.metadata || {};
    const el = document.getElementById('data-provenance');
    if (!el) return;
    if (!md.pipeline_version && !md.alignment) { showEl('provenance-section', false); return; }
    const al = md.alignment || {}, nm = md.normalization || {}, nt = md.novel_text || {};
    const corr = nm.corrections || [], ren = nm.renamed || [], spl = nm.split || [];
    el.innerHTML = `
        <div>Dialogues: <strong>${md.total_dialogues ?? '—'}</strong></div>
        <div>Chapters: <strong>${(md.chapters || []).length}</strong></div>
        ${al.total ? `<div>Aligned to text: <strong>${al.exact}</strong> exact, <strong>${al.partial}</strong> partial, <strong>${al.interpolated}</strong> interpolated</div>` : ''}
        ${nt.running_heads_removed !== undefined ? `<div>Running heads removed: <strong>${nt.running_heads_removed}</strong></div>` : ''}
        <details><summary>Normalization (${corr.length + ren.length + spl.length})</summary>
            <ul>
                ${corr.map(c => `<li>Correction #${c.id}: ${c.field}</li>`).join('')}
                ${ren.map(r => `<li>${r.change} (${r.occurrences}×)</li>`).join('')}
                ${spl.map(x => `<li>${x.composite} → ${x.into.join(' + ')}</li>`).join('')}
            </ul>
        </details>
        ${md.predation ? `<div style="margin-top:8px;">Predation events: <strong>${md.predation.events_total}</strong>${md.predation.complete ? '' : ` <span style="color:#f59e0b;">(provisional — ${md.predation.status.pending || 0} pending)</span>`}</div>
        <div>Suggestion agreement: agent <strong>${md.predation.agreement.agent.agreement ?? '—'}</strong>, patient <strong>${md.predation.agreement.patient.agreement ?? '—'}</strong></div>` : ''}
        <div style="margin-top:8px;">Pipeline: <strong>${md.pipeline_version || '—'}</strong></div>
        <div>Generated: <strong>${md.generated_at || '—'}</strong></div>`;
}

function updateStats() {
    document.getElementById('stat-nodes').textContent = networkData.metadata.total_nodes;
    document.getElementById('stat-edges').textContent = networkData.metadata.total_edges;
    document.getElementById('stat-communities').textContent = networkData.metadata.total_communities;
}

// ---- Mobile: fit the whole network to the screen ----
const isMobileView = () => window.matchMedia('(max-width: 768px)').matches;

function fitToScreen(duration = 750) {
    if (!svg || !g) return;
    const bounds = g.node().getBBox();
    if (!bounds.width || !bounds.height) return;
    const width = +svg.attr('width'), height = +svg.attr('height');
    const pad = 24;
    const scale = Math.min(
        (width - pad * 2) / bounds.width,
        (height - pad * 2) / bounds.height,
        1.5
    );
    const tx = width / 2 - scale * (bounds.x + bounds.width / 2);
    const ty = height / 2 - scale * (bounds.y + bounds.height / 2);
    svg.transition().duration(duration)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
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
    if (isMobileView()) {
        // Fit once while the layout forms, then refine when it settles
        const initialSim = simulation;
        let roughFitDone = false;
        initialSim.on('tick.fit', () => {
            if (!roughFitDone && initialSim.alpha() < 0.3) {
                roughFitDone = true;
                fitToScreen(600);
            }
        });
        initialSim.on('end.fit', () => {
            fitToScreen(400);
            initialSim.on('tick.fit', null).on('end.fit', null);
        });
    }
    window.addEventListener('resize', () => {
        const w = container.clientWidth, h = container.clientHeight;
        svg.attr('width', w).attr('height', h);
        simulation.force('center', d3.forceCenter(w / 2, h / 2)).alpha(0.3).restart();
    });
}

function renderNetwork() {
    if (communityView) return;
    const predMode = currentFilter === 'predation' && hasPredation();
    showEl('legend-predation', predMode, 'flex');
    showEl('legend-predation-color', predMode, 'flex');
    setPredationForces(predMode);
    if (predMode) { renderPredationNetwork(); return; }
    const minDialogues = parseInt(document.getElementById('min-dialogues').value);
    const minWeight = parseInt(document.getElementById('min-weight').value);
    const rangeOn = chapterRangeActive();
    let filteredNodes = networkData.nodes.filter(n => {
        if (n.hidden || rangeDialogues(n) < minDialogues) return false;
        if (hideCollectives && n.gender === 'C') return false;
        if (rangeOn && n.chapter_activity && rangePresence(n) === 0) return false;
        return true;
    });
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    let edgesToUse = networkData.edges;
    if (rangeOn) {
        // recompute edge counts from the per-chapter breakdown
        edgesToUse = networkData.edges.map(e => {
            let direct = 0, copresence = 0, words = 0;
            Object.entries(e.by_chapter || {}).forEach(([idx, v]) => {
                if (inChapterRange(idx)) { direct += v[0]; copresence += v[1]; words += v[2]; }
            });
            if (direct + copresence === 0) return null;
            return { ...e, source: e.source.id || e.source, target: e.target.id || e.target, direct, copresence, words, weight: direct * 2 + copresence };
        }).filter(Boolean);
    }
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
    document.getElementById('stat-nodes').textContent = filteredNodes.length;
    document.getElementById('stat-edges').textContent = filteredEdges.length;
    updateChapterNote(filteredNodes.length, filteredEdges.length);
    g.selectAll('*').remove();
    link = g.append('g').selectAll('line').data(filteredEdges).join('line')
        .attr('class', d => { if (currentFilter === 'direct') return 'link link-direct'; if (currentFilter === 'copresence') return 'link link-copresence'; return d.direct > d.copresence ? 'link link-direct' : 'link link-copresence'; })
        .attr('stroke-width', d => { const w = currentFilter === 'direct' ? d.direct : currentFilter === 'copresence' ? d.copresence : d.weight; return Math.sqrt(w) * 0.8; })
        .attr('stroke-opacity', 0.6);
    node = g.append('g').selectAll('circle').data(filteredNodes).join('circle')
        .attr('class', d => { let c = ['node']; if (d.meta_identity != null) { if (d.identity_type === 'avatar') c.push('vampire-avatar'); else if (d.identity_type === 'true_form') c.push('vampire-true-form'); else if (d.identity_type === 'merged') c.push('vampire-merged'); } return c.join(' '); })
        .attr('r', d => d.identity_type === 'merged' ? Math.max(20, Math.sqrt(d.dialogue_count) * 3) : Math.max(5, Math.sqrt(rangeDialogues(d)) * 2))
        .attr('fill', d => d.identity_type === 'merged' ? '#8b5cf6' : communityColors[d.community % communityColors.length])
        //.attr('stroke', d => { if (d.meta_identity === 'Vampirul' && d.identity_type === 'avatar') return '#ef4444'; if (d.identity_type === 'merged') return '#8b5cf6'; return '#fff'; })
        .attr('stroke', d => { if (d.meta_identity != null && d.identity_type === 'true_form') return '#ef4444'; if (d.meta_identity != null && d.identity_type === 'merged') return '#8b5cf6'; if (d.meta_identity != null) return '#ef4444'; return '#fff'; })
        .attr('stroke-width', d => d.meta_identity != null ? 3 : 2)
        .call(drag(simulation)).on('mouseover', handleNodeHover).on('mouseout', handleNodeOut).on('click', handleNodeClick);
    label = g.append('g').selectAll('text').data(filteredNodes).join('text')
        .attr('class', 'node-label').attr('text-anchor', 'middle')
        .attr('dy', d => Math.max(5, Math.sqrt(rangeDialogues(d)) * 2) + 15)
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

function setPredationForces(on) {
    if (!simulation) return;
    const w = +svg.attr('width'), h = +svg.attr('height');
    if (on) {
        simulation.force('charge', d3.forceManyBody().strength(-120))
            .force('x', d3.forceX(w / 2).strength(0.08))
            .force('y', d3.forceY(h / 2).strength(0.08))
            .force('collision', d3.forceCollide().radius(28));
        simulation.force('link').distance(90).strength(0.5);
    } else if (simulation.force('x')) {
        simulation.force('charge', d3.forceManyBody().strength(-300))
            .force('x', null).force('y', null)
            .force('collision', d3.forceCollide().radius(40));
        simulation.force('link').distance(d => d.direct > d.copresence ? 80 : 150).strength(d => Math.min((d.weight || 1) / 50, 1));
    }
}

function renderPredationNetwork() {
    const minWeight = parseInt(document.getElementById('min-weight').value);
    const rangeOn = chapterRangeActive();
    const edges = (networkData.predation_edges || []).map(e => {
        let total = e.total, figurativeOnly = e.literal === 0;
        if (rangeOn) total = Object.entries(e.by_chapter || {}).reduce((s, [idx, v]) => s + (inChapterRange(idx) ? v : 0), 0);
        return total > 0 ? { source: e.source, target: e.target, total, literal: e.literal, figurative: e.figurative, figurativeOnly, weight: total } : null;
    }).filter(e => e && e.total >= Math.min(minWeight, 1000));
    const allNodes = networkData.nodes.concat(predationEntityNodes);
    const counts = new Map(allNodes.map(n => [n.id, predationRangeCounts(n.predation)]));
    let nodesP = allNodes.filter(n => {
        const c = counts.get(n.id);
        if (hideCollectives && n.gender === 'C') return false;
        return c.agent + c.patient > 0;
    });
    const ids = new Set(nodesP.map(n => n.id));
    const edgesP = edges.filter(e => ids.has(e.source) && ids.has(e.target));
    const radius = n => { const c = counts.get(n.id); return Math.max(6, Math.sqrt(c.agent + c.patient) * 4); };

    document.getElementById('stat-nodes').textContent = nodesP.length;
    document.getElementById('stat-edges').textContent = edgesP.length;
    updateChapterNote(nodesP.length, edgesP.length);

    ensurePredationMarker();
    g.selectAll('*').remove();
    link = g.append('g').selectAll('line').data(edgesP).join('line')
        .attr('class', d => 'link link-predation' + (d.figurativeOnly ? ' figurative-only' : ''))
        .attr('stroke-width', d => Math.max(1.2, Math.sqrt(d.total) * 1.6))
        .attr('marker-end', 'url(#pred-arrow)');
    node = g.append('g').selectAll('circle').data(nodesP).join('circle')
        .attr('class', d => 'node' + (d.entity ? ' predation-entity' : ''))
        .attr('r', radius)
        .attr('fill', d => { const c = counts.get(d.id); return predationColor(c.agent, c.patient); })
        .attr('stroke', d => d.entity ? '#9195a0' : '#fff').attr('stroke-width', 2)
        .call(drag(simulation)).on('mouseover', handleNodeHover).on('mouseout', handleNodeOut).on('click', handleNodeClick);
    label = g.append('g').selectAll('text').data(nodesP).join('text')
        .attr('class', 'node-label').attr('text-anchor', 'middle')
        .attr('dy', d => radius(d) + 14)
        .text(d => d.label).style('fill', '#e8eaed').style('display', showLabels ? 'block' : 'none');
    simulation.nodes(nodesP);
    simulation.force('link').links(edgesP);
    simulation.alpha(1).restart();
    // the predation graph is small and spreads out: fit it to the screen once it settles
    simulation.on('end.predfit', () => { fitToScreen(600); simulation.on('end.predfit', null); });
    simulation.on('tick', () => {
        link.each(function (d) {
            const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1, r = radius(d.target) + 3;
            d3.select(this).attr('x1', d.source.x).attr('y1', d.source.y)
                .attr('x2', d.target.x - dx / dist * r).attr('y2', d.target.y - dy / dist * r);
        });
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
    const vampMarker = d.meta_identity != null
        ? `<div class="tooltip-vampire-marker">🩸 ${identityConfig().marker}</div>`
        : '';
    document.getElementById('tooltip').innerHTML = `
                <div class="tooltip-title">${d.label}</div>
                ${vampMarker}
                <div class="tooltip-stat"><span class="tooltip-stat-label">Dialogues:</span><span class="tooltip-stat-value">${d.dialogue_count}</span></div>
                ${chapterRangeActive() ? `<div class="tooltip-stat"><span class="tooltip-stat-label">In selected chapters:</span><span class="tooltip-stat-value">${rangeDialogues(d)}</span></div>` : ''}
                <div class="tooltip-stat"><span class="tooltip-stat-label">Connections:</span><span class="tooltip-stat-value">${d.degree}</span></div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Centrality:</span><span class="tooltip-stat-value">${(d.degree_centrality * 100).toFixed(1)}%</span></div>
                <div class="tooltip-stat"><span class="tooltip-stat-label">Betweenness:</span><span class="tooltip-stat-value">${(d.betweenness_centrality * 100).toFixed(1)}%</span></div>
                ${vocabLine}
                ${hasPredation() && d.predation ? (() => { const c = predationRangeCounts(d.predation); return `<div class="tooltip-stat"><span class="tooltip-stat-label">Preys / preyed on:</span><span class="tooltip-stat-value">${c.agent} / ${c.patient}</span></div>`; })() : ''}
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
    });
    document.getElementById('reset-zoom').addEventListener('click', () => {
        if (isMobileView()) { fitToScreen(); return; }
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });
    const vt = document.getElementById('vampire-toggle');
    if (vt) vt.addEventListener('click', toggleVampireMerge);
    // ---- additions (legacy pipeline 1.2): reset, collectives, chapter range ----
    ensureResetButton().addEventListener('click', resetFilters);
    const collBtn = document.getElementById('toggle-collectives');
    if (collBtn) collBtn.addEventListener('click', e => {
        hideCollectives = !hideCollectives;
        e.target.classList.toggle('active', hideCollectives);
        e.target.textContent = hideCollectives ? 'Show Collectives' : 'Hide Collectives';
        renderNetwork();
    });
    if (hasChapters() && document.getElementById('chapter-from')) {
        const ch = networkData.metadata.chapters;
        chapterFrom = ch[0].index; chapterTo = ch[ch.length - 1].index;
        document.getElementById('chapter-from').addEventListener('change', onChapterChange);
        document.getElementById('chapter-to').addEventListener('change', onChapterChange);
    }
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
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false
        }).then(canvas => {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                const inverted = 255 - gray;

                data[i] = inverted;
                data[i + 1] = inverted;
                data[i + 2] = inverted;
            }

            ctx.putImageData(imageData, 0, 0);

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