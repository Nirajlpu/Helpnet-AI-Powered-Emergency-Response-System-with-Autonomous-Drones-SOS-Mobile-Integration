export const isAlphaNumeric = (val) => !!val && /^[\\w]+$/.test('' + val.trim());
export const isNullSafe = (val) => val === 0 || !!val;
export const Validate = {
    isAlphaNumeric,
    isNullSafe,
};
export default Validate;
