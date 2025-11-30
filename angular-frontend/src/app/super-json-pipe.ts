import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'superJson'
})
export class SuperJsonPipe implements PipeTransform {

  transform(value: any): string {
    try {
      const parsed = this.deepParse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(value);
    }
  }

  private deepParse(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;

    // Handle string with prefix: "<txt>: {json}"
    if (typeof value === 'string') {
      const idx = value.indexOf('{');
      const idxArr = value.indexOf('[');

      const cut = (idx >= 0 && (idx < idxArr || idxArr < 0)) ? idx :
                  (idxArr >= 0 ? idxArr : -1);

      if (cut > 0) {
        const prefix = value.substring(0, cut).trim().replace(/:$/, '');
        const jsonPart = value.substring(cut).trim();

        try {
          const parsedJson = this.deepParse(JSON.parse(jsonPart));
          return { prefix, data: parsedJson };
        } catch {
          return value; // Not JSON after prefix
        }
      }

      // If whole string is JSON
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.deepParse(parsed);
        } catch {
          return value;
        }
      }

      return value;
    }

    // Array
    if (Array.isArray(value)) {
      return value.map(v => this.deepParse(v));
    }

    // Object
    if (typeof value === 'object') {
      const result: any = {};
      for (const key of Object.keys(value)) {
        result[key] = this.deepParse(value[key]);
      }
      return result;
    }

    return value;
  }

}
