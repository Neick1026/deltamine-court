// Хранилище через GitHub — данные в data/cases.json

const GH_OWNER = 'Neick1026';  // твой GitHub ник
const GH_REPO  = 'deltamine-court';      // название репо
const GH_TOKEN = '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'; // токен с правом repo

const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;

let _casesSha = null;

async function ghRead(path) {
  const res = await fetch(`${GH_API}/${path}`, {
    headers: { 'Authorization': `token ${GH_TOKEN}` }
  });
  if (!res.ok) throw new Error(`GitHub read error ${res.status}`);
  const data = await res.json();
  return {
    content: JSON.parse(atob(data.content.replace(/\n/g, ''))),
    sha: data.sha
  };
}

async function ghWrite(path, content, sha, message) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
    sha
  };
  const res = await fetch(`${GH_API}/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub write error ${res.status}`);
  const result = await res.json();
  return result.content.sha;
}

const DB = {
  _casesSha: null,

  async getCases() {
    const { content, sha } = await ghRead('data/cases.json');
    this._casesSha = sha;
    _casesSha = sha;
    return content;
  },

  async addCase(newCase) {
    const cases = await this.getCases();
    cases.push(newCase);
    const newSha = await ghWrite('data/cases.json', cases, this._casesSha, `Новое дело от ${newCase.plaintiff}`);
    this._casesSha = newSha;
    _casesSha = newSha;
  },

  async updateCase(id, updates) {
    const cases = await this.getCases();
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Дело не найдено');
    Object.assign(cases[idx], updates);
    const newSha = await ghWrite('data/cases.json', cases, this._casesSha, `Дело #${id} → ${updates.status}`);
    this._casesSha = newSha;
    _casesSha = newSha;
    return cases[idx];
  },

  async getJudges() {
    const { content } = await ghRead('data/judges.json');
    return content;
  }
};
