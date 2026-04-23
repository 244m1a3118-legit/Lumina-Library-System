// A mock Firestore SDK adapter that pipes queries to our local MERN (Express) server.

export const collection = (dbInstance: any, path: string) => {
  return { type: 'collection', path };
};

export const doc = (dbInstance: any, path: string, id?: string) => {
  if (!id && path.includes('/')) {
    const parts = path.split('/');
    return { type: 'doc', path: parts[0], id: parts[1] };
  }
  return { type: 'doc', path, id };
};

export const setDoc = async (ref: any, data: any) => {
  // Uses PUT to create or replace
  await fetch(`/api/db/${ref.path}/${ref.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const updateDoc = async (ref: any, data: any) => {
  await fetch(`/api/db/${ref.path}/${ref.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const getDoc = async (ref: any) => {
  const res = await fetch(`/api/db/${ref.path}/${ref.id}`);
  const data = await res.json();
  return {
    exists: () => res.ok && !data.error,
    data: () => data,
    id: data.id || ref.id
  };
};

export const deleteDoc = async (ref: any) => {
  await fetch(`/api/db/${ref.path}/${ref.id}`, { method: 'DELETE' });
};

// Generic query builder
export const query = (ref: any, ...ops: any[]) => {
  return { ...ref, ops };
};

export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
export const limit = (num: number) => ({ type: 'limit', num });

export const getDocs = async (ref: any) => {
  const res = await fetch(`/api/db/${ref.path}`);
  let data = await res.json();
  if (!Array.isArray(data)) data = [];
  
  if (ref.ops) {
    ref.ops.forEach((op: any) => {
      if (op.type === 'where') {
        data = data.filter((d: any) => {
          if (op.op === '==') return d[op.field] === op.value;
          if (op.op === '>') return d[op.field] > op.value;
          if (op.op === '<') return d[op.field] < op.value;
          return true;
        });
      }
      if (op.type === 'orderBy') {
        data = data.sort((a: any, b: any) => {
          const vA = a[op.field];
          const vB = b[op.field];
          if (vA < vB) return op.dir === 'desc' ? 1 : -1;
          if (vA > vB) return op.dir === 'desc' ? -1 : 1;
          return 0;
        });
      }
    });

    // Apply limits after sorting
    ref.ops.forEach((op: any) => {
      if (op.type === 'limit') {
        data = data.slice(0, op.num);
      }
    });
  }

  const docs = data.map((d: any) => ({
    id: d.id,
    data: () => d
  }));
  return {
    docs,
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb)
  };
};

// Real-time listener mock (polls every 3 seconds)
export const onSnapshot = (ref: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {
  let isCancelled = false;
  let lastDataStr = '';

  const fetchAndCallback = async () => {
    if (isCancelled) return;
    try {
      const isDoc = ref.type === 'doc';
      const url = isDoc ? `/api/db/${ref.path}/${ref.id}` : `/api/db/${ref.path}`;
      const res = await fetch(url);
      let data = await res.json();
      
      if (!isDoc && ref.ops && Array.isArray(data)) {
        ref.ops.forEach((op: any) => {
          if (op.type === 'where') {
            data = data.filter((d: any) => {
              if (op.op === '==') return d[op.field] === op.value;
              if (op.op === '>') return d[op.field] > op.value;
              if (op.op === '<') return d[op.field] < op.value;
              return true;
            });
          }
          if (op.type === 'orderBy') {
            data = data.sort((a: any, b: any) => {
              const vA = a[op.field];
              const vB = b[op.field];
              if (vA < vB) return op.dir === 'desc' ? 1 : -1;
              if (vA > vB) return op.dir === 'desc' ? -1 : 1;
              return 0;
            });
          }
        });

        // Apply limits after sorting
        ref.ops.forEach((op: any) => {
          if (op.type === 'limit') {
            data = data.slice(0, op.num);
          }
        });
      }

      const newStr = JSON.stringify(data);
      if (newStr !== lastDataStr) {
        lastDataStr = newStr;
        if (isDoc) {
          callback({
            exists: () => !data.error,
            data: () => data,
            id: data.id || ref.id
          });
        } else {
          // If it's a collection, mock the QuerySnapshot
          const arr = Array.isArray(data) ? data : [];
          const docs = arr.map((d: any) => ({
            id: d.id,
            data: () => d
          }));
          callback({
            docs,
            size: docs.length,
            forEach: (cb: any) => docs.forEach(cb)
          });
        }
      }
    } catch (e) {
      console.warn("Mock Firestore polling error:", e);
      if (errorCallback) errorCallback(e);
    }
  };

  fetchAndCallback();
  const intervalId = setInterval(fetchAndCallback, 3000);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
  };
};

export const addDoc = async (ref: any, data: any) => {
  const res = await fetch(`/api/db/${ref.path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  return { id: json.id, path: ref.path };
};
