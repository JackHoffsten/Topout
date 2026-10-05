export const readTheme = async () => localStorage.getItem('topout.theme');
export const writeTheme = async (value: string) => localStorage.setItem('topout.theme', value);
