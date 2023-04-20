/*
*  https://github.com/CommunityXYZ/community-js/blob/master/src/utils.ts#L23
*/
export function _isValidArweaveAddress(address: string) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  return /[a-z0-9_-]{43}/i.test(address);;
}