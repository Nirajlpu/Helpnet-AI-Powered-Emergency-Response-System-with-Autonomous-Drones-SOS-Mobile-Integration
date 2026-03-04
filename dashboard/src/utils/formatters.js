export const formatDate = (date) => new Date(date).toLocaleString();
export const formatCurrency = (amount) => `$${Number(amount).toFixed(2)}`;
export default { formatDate, formatCurrency };
