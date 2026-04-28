export interface OrderItemState {
  id: string;
  orderId: string;
  variantId: string;
  warehouseId: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  unitPrice: string;
  taxRate: string;
  quantity: number;
  lineDiscountTotal: string;
  appliedPromotionIds: unknown;
  lineSubtotal: string;
  lineTaxTotal: string;
  lineGrandTotal: string;
  createdAt: Date;
}

export class OrderItemEntity {
  constructor(private readonly state: OrderItemState) {}

  static fromState(state: OrderItemState): OrderItemEntity {
    return new OrderItemEntity(state);
  }

  toResponse() {
    return {
      id: this.state.id,
      variantId: this.state.variantId,
      warehouseId: this.state.warehouseId,
      variantNameSnapshot: this.state.variantNameSnapshot,
      skuSnapshot: this.state.skuSnapshot,
      unitPrice: this.state.unitPrice,
      taxRate: this.state.taxRate,
      quantity: this.state.quantity,
      lineDiscountTotal: this.state.lineDiscountTotal,
      appliedPromotionIds: this.state.appliedPromotionIds,
      lineSubtotal: this.state.lineSubtotal,
      lineTaxTotal: this.state.lineTaxTotal,
      lineGrandTotal: this.state.lineGrandTotal,
      createdAt: this.state.createdAt,
    };
  }
}
