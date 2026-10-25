export function DailyValues({ label, columns, rows, expandable = true }) {
  const table = <div className="values-scroll"><table className="values-table" aria-label={label}><thead><tr><th scope="col">Date</th>{columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th>{columns.map(c => <td key={c.key}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>;
  return expandable ? <details className="chart-values"><summary>View daily values</summary>{table}</details> : table;
}
