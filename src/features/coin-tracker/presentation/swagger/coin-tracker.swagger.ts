import { ErrorResponseDto } from '@presentation/dto/error-response.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CoinListResponseDto } from '../dto/response/coin-list.response.dto';
import { PriceAlertResponseDto } from '../dto/response/price-alert.response.dto';
import { PriceAlertListResponseDto } from '../dto/response/price-alert-list.response.dto';
import { PRICE_ALERT_PAGE_SIZE_MAX } from '../dto/request/list-price-alerts.request.dto';
import { COIN_PAGE_SIZE_MAX } from '../dto/request/coin-list.request.dto';
import { AlertDirection } from '../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../domain/enums/alert-status.enum';
import { CoinSortField } from '../../domain/enums/coin-sort-field.enum';
import { SortOrder } from '../../domain/enums/sort-order.enum';

export const ApiGetCoins = () =>
  applyDecorators(
    ApiOperation({ summary: 'Search and list supported cryptocurrencies' }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      description: 'Search query to filter coins by name or symbol.'
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description:
        'Opaque cursor from a previous response to fetch the next page.'
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: `Number of items per page (1–${COIN_PAGE_SIZE_MAX}, default 20).`,
      example: 20
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      enum: CoinSortField,
      description: 'Field used to sort the result.',
      example: CoinSortField.NAME
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      enum: SortOrder,
      description: 'Sort direction.',
      example: SortOrder.ASC
    }),
    ApiResponse({
      status: 200,
      description: 'Coins retrieved successfully',
      type: CoinListResponseDto
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid cursor',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Invalid search, pagination, or sorting parameters',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

export const ApiCreatePriceAlert = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a new price alert' }),
    ApiResponse({
      status: 201,
      description: 'Price alert created successfully',
      type: PriceAlertResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'Active coin not found',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Validation error',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

export const ApiListPriceAlerts = () =>
  applyDecorators(
    ApiOperation({ summary: 'List price alerts for current user' }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description:
        'Opaque cursor from a previous response to fetch the next page.'
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: `Number of items per page (1–${PRICE_ALERT_PAGE_SIZE_MAX}, default 20).`,
      example: 20
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: AlertStatus,
      description: 'Filter by alert status'
    }),
    ApiQuery({
      name: 'direction',
      required: false,
      enum: AlertDirection,
      description: 'Filter by direction'
    }),
    ApiQuery({
      name: 'coinId',
      required: false,
      type: String,
      description: 'Filter by coin identifier'
    }),
    ApiResponse({
      status: 200,
      description: 'Price alerts retrieved successfully',
      type: PriceAlertListResponseDto
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid cursor',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Validation error',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

export const ApiUpdatePriceAlert = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update a price alert' }),
    ApiParam({
      name: 'id',
      type: String,
      required: true,
      description: 'Price alert ID'
    }),
    ApiResponse({
      status: 200,
      description: 'Price alert updated successfully',
      type: PriceAlertResponseDto
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'Price alert not found or not owned by the current user',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description:
        'Validation error, empty update, or alert is expired, cancelled, or triggered',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );

export const ApiCancelPriceAlert = () =>
  applyDecorators(
    ApiOperation({ summary: 'Cancel a price alert' }),
    ApiParam({
      name: 'id',
      type: String,
      required: true,
      description: 'Price alert ID'
    }),
    ApiResponse({
      status: 204,
      description: 'Price alert cancelled successfully'
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 404,
      description: 'Price alert not found or not owned by the current user',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 422,
      description: 'Alert is already cancelled or expired',
      type: ErrorResponseDto
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      type: ErrorResponseDto
    })
  );
