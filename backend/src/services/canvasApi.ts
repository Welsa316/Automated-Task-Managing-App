export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: string;
  term?: { name: string };
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  has_submitted_submissions: boolean;
  course_id: number;
  assignment_group_id: number;
  grading_type: string;
  workflow_state: string;
  submission?: {
    submitted_at: string | null;
    score: number | null;
    grade: string | null;
    workflow_state: string;
  };
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

const RATE_LIMIT_DELAY_MS = 2000;
const MAX_RETRIES = 3;

export class CanvasApi {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private async paginatedFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
    const url = new URL(`${this.baseUrl}/api/v1${endpoint}`);
    url.searchParams.set('per_page', '100');
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const results: T[] = [];
    let nextUrl: string | null = url.toString();

    while (nextUrl) {
      let response: Response | null = null;
      let retries = 0;

      while (retries < MAX_RETRIES) {
        response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
        });
        if (response.status === 403) {
          const remaining = response.headers.get('X-Rate-Limit-Remaining');
          if (remaining !== null && parseFloat(remaining) <= 0) {
            retries++;
            if (retries >= MAX_RETRIES) throw new Error('Canvas API rate limit exceeded');
            await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS * retries));
            continue;
          }
          throw new Error(`Canvas API forbidden: ${response.status}`);
        }
        break;
      }

      if (!response || !response.ok) {
        const text = response ? await response.text() : 'no response';
        throw new Error(`Canvas API error: ${text}`);
      }

      const data = (await response.json()) as T | T[];
      if (Array.isArray(data)) results.push(...data);
      else results.push(data);

      nextUrl = parseNextLink(response.headers.get('Link'));
    }

    return results;
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.paginatedFetch<CanvasCourse>('/courses', {
      enrollment_state: 'active', include: 'term', state: 'available',
    });
  }

  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    return this.paginatedFetch<CanvasAssignment>(`/courses/${courseId}/assignments`, {
      include: 'submission', order_by: 'due_at',
    });
  }
}
