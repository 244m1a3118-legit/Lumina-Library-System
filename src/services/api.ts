const API_BASE = '/api';

export const api = {
  async getBooks() {
    const res = await fetch(`${API_BASE}/books`);
    return res.json();
  },
  async addBook(book: any) {
    const res = await fetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
    });
    return res.json();
  },
  async getMembers() {
    const res = await fetch(`${API_BASE}/members`);
    return res.json();
  },
  async addMember(member: any) {
    const res = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });
    return res.json();
  }
};
