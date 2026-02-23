import { redirect } from 'next/navigation';

export default function ShopRedirect() {
  redirect('/catalog');
}