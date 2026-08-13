interface WikiLinkProps extends React.ComponentPropsWithoutRef<'a'> {
  cardName: string;
}

export const WikiLink = (props: WikiLinkProps) => {
  return <a href={`https://duelingnexus.com/wiki/${props.cardName}`} target="_blank" {...props}>
    {props.children}
  </a>
}
